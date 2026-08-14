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

    // 2. Fetch caller's profile to verify admin/superadmin role
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (
      callerProfileError ||
      !callerProfile ||
      (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')
    ) {
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

    if (!role || (role !== 'admin' && role !== 'agent' && role !== 'superadmin')) {
      return NextResponse.json(
        { error: "Invalid access role. Must be 'superadmin', 'admin', or 'agent'." },
        { status: 400 }
      )
    }

    const sanitizedRole = sanitizeInput(role)

    // 5. Prevent an admin from accidentally locking themselves out (self-demotion)
    if (adminUser.id === targetUserId && sanitizedRole !== callerProfile.role) {
      return NextResponse.json(
        { error: 'You cannot demote or change your own administrative account role.' },
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

    // 7. Role-tier permission enforcement:
    // If caller is standard admin (NOT superadmin):
    if (callerProfile.role === 'admin') {
      // Cannot modify an existing admin or superadmin
      if (oldRole === 'admin' || oldRole === 'superadmin') {
        return NextResponse.json(
          {
            error:
              'Forbidden: Administrators cannot modify roles of other Administrators. Only Super Administrators have this privilege.',
          },
          { status: 403 }
        )
      }
      // Cannot promote anyone to admin or superadmin
      if (sanitizedRole === 'admin' || sanitizedRole === 'superadmin') {
        return NextResponse.json(
          {
            error:
              'Forbidden: Only Super Administrators can grant Administrator privileges.',
          },
          { status: 403 }
        )
      }
    }

    // If role is unchanged, return early
    if (oldRole === sanitizedRole) {
      return NextResponse.json({ success: true, profile: targetProfile })
    }

    // 8. Update profile role in DB
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

    // 9. Update user_metadata in Supabase Auth
    try {
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...targetProfile,
          role: sanitizedRole,
        },
      })
    } catch (authMetaErr) {
      console.error('Failed to update auth metadata for user:', authMetaErr)
    }

    // 10. Write entry to audit_log
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

    const roleName =
      sanitizedRole === 'superadmin'
        ? 'Super Administrator'
        : sanitizedRole === 'admin'
        ? 'Administrator'
        : 'Call Agent'

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: `User role updated to ${roleName}.`,
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

    // 2. Fetch caller's profile to verify admin/superadmin role
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (
      callerProfileError ||
      !callerProfile ||
      (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      )
    }

    // 3. Self-deletion guard: cannot delete yourself
    if (adminUser.id === targetUserId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    // 4. Fetch target profile info
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // 5. Tier permission check: standard admin cannot delete other admins or superadmins
    if (
      callerProfile.role === 'admin' &&
      (targetProfile.role === 'admin' || targetProfile.role === 'superadmin')
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Administrators cannot delete other Administrator accounts. Only Super Administrators can delete administrators.',
        },
        { status: 403 }
      )
    }

    // 6. Rate limiting check
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

    // 7. Delete user from Supabase Auth (CASCADE removes profile & sets null on contacts/calls/followups)
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

    // 8. Write entry to audit_log
    const { error: logError } = await supabaseAdmin.from('audit_log').insert({
      actor_id: adminUser.id,
      action: 'DELETE_USER',
      entity_type: 'profile',
      entity_id: targetUserId,
      before_data: {
        id: targetUserId,
        email: targetProfile.email || null,
        full_name: targetProfile.full_name || 'N/A',
        role: targetProfile.role,
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
