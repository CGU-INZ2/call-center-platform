import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import ContactForm from '@/components/shared/ContactForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewContactPage() {
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

  // 3 & 4. Fetch categories and agents concurrently
  const [categoriesRes, agentsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, label, color_hex')
      .order('label', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'agent')
      .order('full_name', { ascending: true })
  ])

  const { data: categories, error: catError } = categoriesRes
  const { data: agentsData, error: agentsError } = agentsRes

  if (catError) {
    console.error('Error fetching categories:', catError)
  }
  if (agentsError) {
    console.error('Error fetching agents:', agentsError)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader 
          title="Create Contact" 
          description="Add a new contact to the directory with comprehensive detail fields."
        />
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-6">
        <ContactForm 
          mode="create"
          categories={categories || []}
          agents={agentsData || []}
          userRole={userRole}
        />
      </div>
    </div>
  )
}
