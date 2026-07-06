import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  // 1. Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/login')
  }

  // 2. Fetch user profile role to verify they exist
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  return (
    <Suspense fallback={
      <div className="flex h-[50vh] items-center justify-center text-[var(--text-secondary)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-400)] mr-2" />
        Loading dashboard...
      </div>
    }>
      <DashboardClient />
    </Suspense>
  )
}

