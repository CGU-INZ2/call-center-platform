import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import ContactForm from '@/components/shared/ContactForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface EditContactPageProps {
  params: Promise<{ id: string }>
}

export default async function EditContactPage({ params }: EditContactPageProps) {
  const { id } = await params
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

  // 3. Fetch the contact details
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*, agent:profiles!contacts_assigned_agent_id_fkey(id, full_name)')
    .eq('id', id)
    .single()

  if (contactError || !contact) {
    redirect('/contacts')
  }

  // 4. Role Enforcement: Agents can only edit their assigned contacts
  if (userRole === 'agent' && contact.assigned_agent_id !== user.id) {
    redirect('/contacts')
  }

  // 5. Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, label, color_hex')
    .order('label', { ascending: true })

  if (catError) {
    console.error('Error fetching categories:', catError)
  }

  // 6. Fetch agents
  const { data: agentsData, error: agentsError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'agent')
    .order('full_name', { ascending: true })

  if (agentsError) {
    console.error('Error fetching agents:', agentsError)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/contacts/${id}`}>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader 
          title={`Edit Contact: ${contact.full_name}`} 
          description="Update contact information, engagement preferences, or assigned agent details."
        />
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-6">
        <ContactForm 
          mode="edit"
          contact={contact}
          categories={categories || []}
          agents={agentsData || []}
          userRole={userRole}
        />
      </div>
    </div>
  )
}
