import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import ContactsClient from './ContactsClient'

export default async function ContactsPage() {
  const supabase = await createServerSupabase()

  // 1. Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/login')
  }

  // 2. Fetch user profile role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  const userRole = profile.role

  // 3. Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, label, color_hex')
    .order('label', { ascending: true })

  if (catError) {
    console.error('Error fetching categories:', catError)
  }

  // 4. Fetch agents (if Admin)
  let agents: { id: string; full_name: string }[] = []
  if (userRole === 'admin') {
    const { data: agentsData, error: agentsError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'agent')
      .order('full_name', { ascending: true })

    if (agentsError) {
      console.error('Error fetching agents:', agentsError)
    } else {
      agents = agentsData || []
    }
  }

  return (
    <Suspense fallback={
      <div className="flex h-[50vh] items-center justify-center text-[var(--text-secondary)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-400)] mr-2" />
        Loading contacts directory...
      </div>
    }>
      <ContactsClient 
        userRole={userRole}
        initialCategories={categories || []}
        initialAgents={agents}
      />
    </Suspense>
  )
}

