import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FollowupsClient, { type Followup } from './FollowupsClient'

export const metadata = {
  title: 'Follow-ups | Loveworld India Call Center',
  description: 'Manage and review your pending follow-up calls',
}

export default async function FollowupsPage() {
  const supabase = await createServerSupabase()

  // 1. Auth check
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  // 2. Fetch profile for role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) redirect('/login')

  // 3. Fetch all pending follow-ups (RLS scopes to agent automatically)
  const { data: followupsRaw, error: followupsError } = await supabase
    .from('followups')
    .select(`
      id,
      due_at,
      status,
      notes,
      created_at,
      contact:contacts(id, full_name, phone, call_status),
      agent:profiles!followups_agent_id_fkey(full_name)
    `)
    .eq('status', 'pending')
    .order('due_at', { ascending: true })

  if (followupsError) {
    console.error('Error fetching followups:', followupsError.message)
  }

  // PostgREST returns FK joins as arrays in TS types even though they're single objects at runtime.
  // Cast to the proper Followup shape.
  const followups = (followupsRaw ?? []) as unknown as Followup[]

  return (
    <FollowupsClient
      followups={followups}
      userRole={profile.role}
    />
  )
}
