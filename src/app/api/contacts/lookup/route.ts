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
    const phone = searchParams.get('phone') || ''

    if (!phone || phone.trim().length < 3) {
      return NextResponse.json({ contacts: [] })
    }

    // Clean phone number input (remove spaces, dashes)
    const cleanPhone = phone.replace(/[^0-9+]/g, '')

    // Prefix/infix match on phone. Limited to 5 results.
    // Supabase RLS isolates the results: Agents only see matching contacts assigned to them.
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, full_name, phone, assigned_agent_id')
      .ilike('phone', `%${cleanPhone}%`)
      .limit(5)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ contacts: contacts || [] })
  } catch (err: any) {
    console.error('Phone lookup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
