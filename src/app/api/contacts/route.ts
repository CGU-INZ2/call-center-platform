import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { isRateLimited } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/sanitize'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase()
    
    // 1. Get caller session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch caller's profile to determine role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const search = sanitizeInput(searchParams.get('search') || '')
    const category_id = searchParams.get('category_id') || ''
    const assigned_agent_id = searchParams.get('assigned_agent_id') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build the query. Join with categories and profiles for rich data grid.
    let query = supabase
      .from('contacts')
      .select('*, category:categories(id, label, color_hex), agent:profiles!contacts_assigned_agent_id_fkey(id, full_name)', { count: 'exact' })

    // Role filtering: agents can ONLY query contacts assigned to them.
    // However, Supabase RLS enforces this automatically on the table.
    // We explicitly append the filter to ensure pagination count matches what the agent is allowed to see.
    if (profile.role === 'agent') {
      query = query.eq('assigned_agent_id', user.id)
    } else if (profile.role === 'admin') {
      if (assigned_agent_id) {
        if (assigned_agent_id === 'unassigned') {
          query = query.is('assigned_agent_id', null)
        } else {
          query = query.eq('assigned_agent_id', assigned_agent_id)
        }
      }
    }

    if (category_id) {
      query = query.eq('category_id', parseInt(category_id, 10))
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      contacts: data,
      count: count || 0,
      page,
      limit
    })
  } catch (err: any) {
    console.error('Fetch contacts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabase()
    
    // 1. Get caller session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch caller's profile to determine role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    const body = await request.json()
    const { ids, patch } = body

    if (!Array.isArray(ids) || ids.length === 0 || !patch || typeof patch !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Rate limiting check
    const ip = request.headers.get('x-forwarded-for') || user.id
    const rateLimit = await isRateLimited({
      action: 'update_contact',
      identifier: ip,
      maxRequests: 60,
      windowMs: 60000 // 1 minute
    })

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Sanitize string values inside patch
    const sanitizedPatch: any = {}
    for (const key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        sanitizedPatch[key] = typeof patch[key] === 'string' ? sanitizeInput(patch[key]) : patch[key]
      }
    }

    // Security check: non-admins cannot change assigned_agent_id
    if (profile.role !== 'admin') {
      if ('assigned_agent_id' in sanitizedPatch && sanitizedPatch.assigned_agent_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: Agents cannot reassign contacts' }, { status: 403 })
      }
      // Agents shouldn't edit created_by or created_at
      delete sanitizedPatch.created_by
      delete sanitizedPatch.created_at
    }

    // Perform bulk update.
    // Supabase RLS enforces that agents can only update their assigned contacts.
    const { data, error } = await supabase
      .from('contacts')
      .update(sanitizedPatch)
      .in('id', ids)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      updated_ids: data?.map(d => d.id) || []
    })
  } catch (err: any) {
    console.error('Bulk update contacts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    
    // 1. Get caller session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch caller's profile to determine role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    // Rate limiting check
    const ip = request.headers.get('x-forwarded-for') || user.id
    const rateLimit = await isRateLimited({
      action: 'create_contact',
      identifier: ip,
      maxRequests: 60,
      windowMs: 60000 // 1 minute
    })

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await request.json()
    const {
      full_name,
      phone,
      email,
      category_id,
      assigned_agent_id,
      notes,
      language,
      country,
      state,
      district_city,
      raw_address,
      watched_program,
      program_name,
      want_prayer,
      prayer_day_time,
      want_ror_daily,
      cell_group_name,
      cell_group_leader,
      call_status,
      source
    } = body

    if (!full_name) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    // Sanitize user inputs
    const sanitizedFullName = sanitizeInput(full_name)
    const sanitizedPhone = sanitizeInput(phone)
    const sanitizedEmail = sanitizeInput(email)
    const sanitizedNotes = sanitizeInput(notes)
    const sanitizedLanguage = sanitizeInput(language)
    const sanitizedCountry = sanitizeInput(country)
    const sanitizedState = sanitizeInput(state)
    const sanitizedDistrictCity = sanitizeInput(district_city)
    const sanitizedRawAddress = sanitizeInput(raw_address)
    const sanitizedProgramName = sanitizeInput(program_name)
    const sanitizedPrayerDayTime = sanitizeInput(prayer_day_time)
    const sanitizedCellGroupName = sanitizeInput(cell_group_name)
    const sanitizedCellGroupLeader = sanitizeInput(cell_group_leader)
    const sanitizedCallStatus = sanitizeInput(call_status)
    const sanitizedSource = sanitizeInput(source)
    const sanitizedAssignedAgentId = sanitizeInput(assigned_agent_id)

    // Phone normalization: prepend +91 if 10 digits
    let formattedPhone = sanitizedPhone ? sanitizedPhone.trim() : null
    if (formattedPhone) {
      const digits = formattedPhone.replace(/\D/g, '')
      if (digits.length === 10) {
        formattedPhone = `+91${digits}`
      }
    }

    const contactData: any = {
      full_name: sanitizedFullName,
      phone: formattedPhone,
      email: sanitizedEmail || null,
      category_id: category_id ? parseInt(category_id, 10) : null,
      notes: sanitizedNotes || null,
      geo_status: 'unmapped',
      country: sanitizedCountry || 'India',
      state: sanitizedState || null,
      district_city: sanitizedDistrictCity || null,
      language: sanitizedLanguage || null,
      raw_address: sanitizedRawAddress || null,
      watched_program: watched_program === true || watched_program === 'true',
      program_name: sanitizedProgramName || null,
      want_prayer: want_prayer === true || want_prayer === 'true',
      prayer_day_time: sanitizedPrayerDayTime || null,
      want_ror_daily: want_ror_daily === true || want_ror_daily === 'true',
      cell_group_name: sanitizedCellGroupName || null,
      cell_group_leader: sanitizedCellGroupLeader || null,
      call_status: sanitizedCallStatus || 'New',
      source: sanitizedSource || null
    }

    if (profile.role === 'agent') {
      // Force agent-scoped values to satisfy RLS
      contactData.created_by = user.id
      contactData.assigned_agent_id = user.id
    } else {
      // Admin can specify creator and assigned agent
      contactData.created_by = user.id
      contactData.assigned_agent_id = sanitizedAssignedAgentId || null
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert(contactData)
      .select('*, category:categories(id, label, color_hex), agent:profiles!contacts_assigned_agent_id_fkey(id, full_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, contact: data })
  } catch (err: any) {
    console.error('Create contact error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

