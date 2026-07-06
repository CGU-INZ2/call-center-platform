import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
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

    // 3. Fetch all users using admin client
    const supabaseAdmin = createAdminClient()
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 })
    }

    // 4. Fetch profiles to get phone, avatar, and active status
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
    }

    // Combine auth users with their profile details
    const combinedUsers = users.map((user) => {
      const userProfile = profiles?.find((p) => p.id === user.id)
      return {
        id: user.id,
        email: user.email,
        full_name: userProfile?.full_name || user.user_metadata?.full_name || 'N/A',
        role: userProfile?.role || user.user_metadata?.role || 'agent',
        is_active: userProfile ? userProfile.is_active : true,
        phone: userProfile?.phone || user.phone || null,
        created_at: userProfile?.created_at || user.created_at,
        last_sign_in_at: user.last_sign_in_at
      }
    })

    return NextResponse.json({ users: combinedUsers })
  } catch (err: any) {
    console.error('List users error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
