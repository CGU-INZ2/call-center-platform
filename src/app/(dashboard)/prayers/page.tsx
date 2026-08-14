import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrayersClient from './PrayersClient'

export const metadata = {
  title: 'Prayer Requests | INZ2 Call Center',
  description: 'View and manage all prayer requests and testimonies from contacts.',
}

export default async function PrayersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profileData?.role === 'admin' || profileData?.role === 'superadmin'

  const { data: prayers, error } = await supabase
    .from('prayer_requests')
    .select('id, created_at, type, content, agent:profiles!prayer_requests_agent_id_fkey(full_name), contact:contacts!prayer_requests_contact_id_fkey(id, full_name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching prayer requests:', error.message)
  }

  return <PrayersClient prayers={(prayers ?? []) as any[]} isAdmin={isAdmin} />
}
