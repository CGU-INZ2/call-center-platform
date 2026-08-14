import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TemplatesClient from './TemplatesClient'

export const metadata = {
  title: 'WhatsApp Templates | INZ2 Call Center',
  description: 'Manage reusable WhatsApp message templates.',
}

export default async function TemplatesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Admin & Superadmin page
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) redirect('/')

  return <TemplatesClient />
}
