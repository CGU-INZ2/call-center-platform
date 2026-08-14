import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import AnalyticsClient from './AnalyticsClient'

export const metadata = {
  title: 'Analytics & Performance | Ministry Call Center',
  description: 'Track outreach analytics, call outcomes, conversion pipelines, and agent performance.',
}

export default async function AnalyticsPage() {
  const supabase = await createServerSupabase()

  // 1. Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // 2. Fetch profile to ensure account exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-[50vh] items-center justify-center text-[var(--text-secondary)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-400)] mr-2" />
          Loading analytics...
        </div>
      }
    >
      <AnalyticsClient />
    </Suspense>
  )
}
