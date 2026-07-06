import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

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

    // Phone normalization: prepend +91 if 10 digits
    let formattedPhone = phone ? phone.trim() : null
    if (formattedPhone) {
      const digits = formattedPhone.replace(/\D/g, '')
      if (digits.length === 10) {
        formattedPhone = `+91${digits}`
      }
    }

    const updateData: any = {
      full_name,
      phone: formattedPhone,
      email: email || null,
      category_id: category_id ? parseInt(category_id, 10) : null,
      notes: notes || null,
      country: country || 'India',
      state: state || null,
      district_city: district_city || null,
      language: language || null,
      raw_address: raw_address || null,
      watched_program: watched_program === true || watched_program === 'true',
      program_name: program_name || null,
      want_prayer: want_prayer === true || want_prayer === 'true',
      prayer_day_time: prayer_day_time || null,
      want_ror_daily: want_ror_daily === true || want_ror_daily === 'true',
      cell_group_name: cell_group_name || null,
      cell_group_leader: cell_group_leader || null,
      call_status: call_status || 'New',
      source: source || null
    }

    // Agent role cannot change the assigned agent
    if (profile.role === 'agent') {
      updateData.assigned_agent_id = user.id
    } else {
      updateData.assigned_agent_id = assigned_agent_id || null
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
