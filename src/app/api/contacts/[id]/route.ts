import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { isRateLimited } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/sanitize'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabase()

    // 1. Get caller session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*, category:categories(id, label, color_hex), agent:profiles!contacts_assigned_agent_id_fkey(id, full_name)')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({ contact })
  } catch (err: any) {
    console.error('Fetch contact error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Fetch the existing contact to verify ownership/RLS
    const { data: existingContact, error: fetchError } = await supabase
      .from('contacts')
      .select('assigned_agent_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Role enforcement: Agent can only edit contacts assigned to them
    if (profile.role === 'agent' && existingContact.assigned_agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Agents can only update their assigned contacts' }, { status: 403 })
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

    const updateData: any = {
      full_name: sanitizedFullName,
      phone: formattedPhone,
      email: sanitizedEmail || null,
      category_id: category_id ? parseInt(category_id, 10) : null,
      notes: sanitizedNotes || null,
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

    // Agent role cannot change the assigned agent
    if (profile.role === 'agent') {
      updateData.assigned_agent_id = user.id
    } else {
      updateData.assigned_agent_id = sanitizedAssignedAgentId || null
    }

    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .select('*, category:categories(id, label, color_hex), agent:profiles!contacts_assigned_agent_id_fkey(id, full_name)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, contact: updatedContact })
  } catch (err: any) {
    console.error('Update contact error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
