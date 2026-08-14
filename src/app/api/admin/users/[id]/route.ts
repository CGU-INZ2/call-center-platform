import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/sanitize'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing target user ID' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 1. Get caller session
    const {
      data: { user: adminUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch caller's profile to verify admin role
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      )
    }

    // 3. Rate limiting check
    const ip = request.headers.get('x-forwarded-for') || adminUser.id
    const rateLimit = await isRateLimited({
      action: 'update_user_role',
      identifier: ip,
      maxRequests: 30,
      windowMs: 60000,
    })

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // 4. Parse & validate request body
    const body = await request.json()
    const { role } = body

    if (!role || (role !== 'admin' && role !== 'agent')) {
      return NextResponse.json(
        { error: "Invalid access role. Must be 'admin' or 'agent'." },
        { status: 400 }
      )
    }

    const sanitizedRole = sanitizeInput(role)

    // 5. Prevent an admin from accidentally locking themselves out (self-demotion)
    if (adminUser.id === targetUserId && sanitizedRole !== 'admin') {
      return NextResponse.json(
        { error: 'You cannot demote your own administrator account.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    // 6. Fetch existing profile of the target user
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json(
        { error: 'Target user profile not found.' },
        { status: 404 }
      )
    }

    const oldRole = targetProfile.role

    // If role is unchanged, return early
    if (oldRole === sanitizedRole) {
      return NextResponse.json({ success: true, profile: targetProfile })
    }

    // 7. Update profile role in DB
    const { data: updatedProfile, error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: sanitizedRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .select()
      .single()

    if (updateProfileError) {
      console.error('Failed to update profile role:', updateProfileError)
      return NextResponse.json(
        { error: updateProfileError.message || 'Failed to update profile role.' },
        { status: 500 }
      )
    }

    // 8. Update user_metadata in Supabase Auth
    try {
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...targetProfile,
          role: sanitizedRole,
        },
      })
    } catch (authMetaErr) {
      console.error('Failed to update auth metadata for user:', authMetaErr)
      // Non-fatal, as database profile is the source of truth for RLS
    }

    // 9. Write entry to audit_log
    const { error: logError } = await supabaseAdmin.from('audit_log').insert({
      actor_id: adminUser.id,
      action: 'UPDATE_USER_ROLE',
      entity_type: 'profile',
      entity_id: targetUserId,
      before_data: {
        role: oldRole,
        full_name: targetProfile.full_name,
      },
      after_data: {
        role: sanitizedRole,
        full_name: targetProfile.full_name,
      },
    })

    if (logError) {
      console.error('Failed to log audit record for role update:', logError)
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: `User role updated to ${sanitizedRole === 'admin' ? 'Administrator' : 'Call Agent'}.`,
    })
  } catch (err: any) {
    console.error('Unexpected error in PATCH /api/admin/users/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing target user ID' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 1. Get caller session
    const {
      data: { user: adminUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch caller's profile to verify admin role
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      )
    }

    // 3. Self-deletion guard: cannot delete yourself
    if (adminUser.id === targetUserId) {
      return NextResponse.json(
        { error: 'You cannot delete your own administrator account.' },
        { status: 400 }
      )
    }

    // 4. Rate limiting check
    const ip = request.headers.get('x-forwarded-for') || adminUser.id
    const rateLimit = await isRateLimited({
      action: 'delete_user',
      identifier: ip,
      maxRequests: 10,
      windowMs: 60000,
    })

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const supabaseAdmin = createAdminClient()

    // 5. Fetch target profile info for the audit log
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    // 6. Delete user from Supabase Auth (CASCADE removes profile & sets null on contacts/calls/followups)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

    if (deleteAuthError) {
      console.error('Error deleting user from Supabase Auth:', deleteAuthError)
      return NextResponse.json(
        { error: deleteAuthError.message || 'Failed to delete user account.' },
        { status: 500 }
      )
    }

    // Also ensure profiles row is removed if cascade had any latency
    await supabaseAdmin.from('profiles').delete().eq('id', targetUserId)

    // 7. Write entry to audit_log
    const { error: logError } = await supabaseAdmin.from('audit_log').insert({
      actor_id: adminUser.id,
      action: 'DELETE_USER',
      entity_type: 'profile',
      entity_id: targetUserId,
      before_data: {
        id: targetUserId,
        email: targetProfile?.email || null,
        full_name: targetProfile?.full_name || 'N/A',
        role: targetProfile?.role || 'agent',
      },
      after_data: null,
    })

    if (logError) {
      console.error('Failed to log audit record for user deletion:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'User account permanently removed.',
    })
  } catch (err: any) {
    console.error('Unexpected error in DELETE /api/admin/users/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
