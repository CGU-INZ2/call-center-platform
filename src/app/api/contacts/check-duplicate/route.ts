import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase()

    // 1. Get caller session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ duplicates: [] })
    }

    // Phone normalization: prepend +91 if 10 digits
    let formattedPhone = phone.trim()
    const digits = formattedPhone.replace(/\D/g, '')
    if (digits.length === 10) {
      formattedPhone = `+91${digits}`
    }

    // Lookup matching phone in contacts
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, phone, assigned_agent_id, agent:profiles!contacts_assigned_agent_id_fkey(full_name)')
      .eq('phone', formattedPhone)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ duplicates: data || [] })
  } catch (err: any) {
    console.error('Check duplicate phone error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
