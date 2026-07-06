import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    
    // 1. Get caller session
    const { data: { user: adminUser }, error: userError } = await supabase.auth.getUser()
    if (userError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch caller's profile to verify admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // 3. Parse request body
    const { email, password, fullName, role } = await request.json()
    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (role !== 'admin' && role !== 'agent') {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
    }

    // 4. Create user using admin client (bypasses RLS & verification flows)
    const supabaseAdmin = createAdminClient()
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role
      }
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const newUser = userData.user
    if (!newUser) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // 5. Log action in audit log
    const { error: logError } = await supabaseAdmin.from('audit_log').insert({
      actor_id: adminUser.id,
      action: 'CREATE_USER',
      entity_type: 'profile',
      entity_id: newUser.id,
      after_data: {
        email,
        role,
        full_name: fullName
      }
    })

    if (logError) {
      console.error('Audit log error:', logError)
      // Do not fail the request if audit logging fails
    }

    return NextResponse.json({ success: true, user: newUser })
  } catch (err: any) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
