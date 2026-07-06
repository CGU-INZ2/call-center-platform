import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ImportClient from './ImportClient'

export default async function ImportSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile to verify admin role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile || profile.role !== 'admin') {
    redirect('/')
  }

  return <ImportClient />
}
