import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import InteractionTimeline, { TimelineEvent } from './InteractionTimeline'
import CallLogModal from '@/components/shared/CallLogModal'
import WhatsAppModal from '@/components/shared/WhatsAppModal'
import PrayerRequestModal from '@/components/shared/PrayerRequestModal'
import DeleteContactButton from './DeleteContactButton'
import {
  ArrowLeft,
  Phone,
  Mail,
  Edit,
  ExternalLink,
  MessageSquare,
  User,
  MapPin,
  Globe,
  Languages,
  Users,
  Heart,
  Tv,
  BookOpen,
  CalendarDays,
  Tag,
  ClipboardList,
  StickyNote
} from 'lucide-react'

interface ContactDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = await params
  const supabase = await createServerSupabase()

  // 1. Auth check
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  // Fetch caller profile for role checks
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = callerProfile?.role === 'superadmin'

  // 2. Fetch contact (primary data — server component, no spinner)
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*, category:categories(id, label, color_hex), agent:profiles!contacts_assigned_agent_id_fkey(id, full_name)')
    .eq('id', id)
    .single()

  if (contactError || !contact) redirect('/contacts')

  // 3. Parallel-fetch interaction data (secondary)
  const [callsRes, followupsRes, whatsappRes, prayerRes] = await Promise.all([
    supabase
      .from('calls')
      // PostgREST alias: DB column is duration_secs, aliased to duration_seconds for InteractionTimeline
      .select('id, created_at, outcome, duration_seconds:duration_secs, notes, next_action, agent:profiles!calls_agent_id_fkey(full_name)')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('followups')
      .select('id, created_at, due_at, status, notes, agent:profiles!followups_agent_id_fkey(full_name)')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('whatsapp_messages')
      // DB column is template_used (not template_name) — aliased to whatsappTemplate in timeline mapper
      .select('id, created_at, template_used, body')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('prayer_requests')
      // prayer_requests has no notes column — content is the field
      .select('id, created_at, type, content')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
  ])

  // 4. Merge & sort the timeline events
  const timelineEvents: TimelineEvent[] = [
    ...(callsRes.data || []).map((c: any) => ({
      id: `call-${c.id}`,
      type: 'call' as const,
      timestamp: c.created_at,
      notes: c.notes,
      agentName: c.agent?.full_name,
      callOutcome: c.outcome,
      callDuration: c.duration_seconds,
      callNextAction: c.next_action,
    })),
    ...(followupsRes.data || []).map((f: any) => ({
      id: `followup-${f.id}`,
      type: 'followup' as const,
      timestamp: f.created_at,
      notes: f.notes,
      agentName: f.agent?.full_name,
      followupDueAt: f.due_at,
      followupStatus: f.status,
    })),
    ...(whatsappRes.data || []).map((w: any) => ({
      id: `whatsapp-${w.id}`,
      type: 'whatsapp' as const,
      timestamp: w.created_at,
      whatsappTemplate: w.template_used,   // DB column is template_used
      whatsappBody: w.body,
    })),
    ...(prayerRes.data || []).map((p: any) => ({
      id: `prayer-${p.id}`,
      type: 'prayer' as const,
      timestamp: p.created_at,
      prayerType: p.type,
      prayerContent: p.content,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const categoryColor = contact.category?.color_hex || '#5a5a6e'

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-3">
        <Link href="/contacts">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[var(--text-secondary)] hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <p className="text-xs text-[var(--text-muted)]">
            <Link href="/contacts" className="hover:text-white transition-colors">Contacts</Link>
            {' / '}
            <span className="text-[var(--text-secondary)]">{contact.full_name}</span>
          </p>
        </div>
      </div>

      {/* Two-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* ============================
            LEFT COLUMN (60%)
        ============================ */}
        <div className="lg:col-span-3 space-y-5">

          {/* Header Card */}
          <Card
            className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-md)] overflow-hidden"
            style={{ borderLeft: `4px solid ${categoryColor}` }}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 min-w-0">
                  {/* Name */}
                  <h2 className="text-2xl font-bold text-white leading-tight truncate">
                    {contact.full_name}
                  </h2>

                  {/* Phone — prominent, monospace, clickable */}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="block font-mono text-2xl font-semibold text-[var(--gold-400)] hover:text-[var(--gold-300)] transition-colors tracking-wide"
                    >
                      {contact.phone}
                    </a>
                  )}

                  {/* Email */}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {contact.email}
                    </a>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {contact.category && (
                    <Badge
                      variant="outline"
                      className="px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: `${categoryColor}15`,
                        color: categoryColor,
                        borderColor: `${categoryColor}35`
                      }}
                    >
                      {contact.category.label}
                    </Badge>
                  )}
                  {contact.call_status && (
                    <Badge
                      variant="outline"
                      className="px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)] border-[var(--border-default)]"
                    >
                      {contact.call_status}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Bar */}
          <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Call */}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`}>
                    <Button
                      variant="outline"
                      className="bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </Button>
                  </a>
                )}

                {/* WhatsApp — Sprint 5.1 */}
                {contact.phone && (
                  <WhatsAppModal
                    contactId={id}
                    contactName={contact.full_name}
                    contactPhone={contact.phone}
                  />
                )}

                {/* Edit */}
                <Link href={`/contacts/${id}/edit`}>
                  <Button
                    variant="outline"
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </Link>

                {/* Log Call — Sprint 3.1 */}
                <CallLogModal
                  contactId={id}
                  contactName={contact.full_name}
                  currentStatus={contact.call_status ?? null}
                />

                {/* Log Prayer / Testimony — Sprint 5.2 */}
                <PrayerRequestModal
                  contactId={id}
                  contactName={contact.full_name}
                />

                {/* Delete Contact (Superadmin Only) */}
                {isSuperAdmin && (
                  <DeleteContactButton
                    contactId={id}
                    contactName={contact.full_name}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Interaction Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-1">
              Interaction History
            </h3>
            <InteractionTimeline events={timelineEvents} />
          </div>
        </div>

        {/* ============================
            RIGHT COLUMN (40%)
        ============================ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Contact Details Card */}
          <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
            <CardContent className="p-5 space-y-1">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">
                Contact Details
              </h3>

              <dl className="space-y-3.5 text-sm">

                {/* Location */}
                {(contact.country || contact.state || contact.district_city) && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <MapPin className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd className="text-[var(--text-primary)]">
                      {[contact.district_city, contact.state, contact.country]
                        .filter(Boolean)
                        .join(', ')}
                    </dd>
                  </div>
                )}

                {contact.raw_address && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <Globe className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd className="text-[var(--text-secondary)] italic text-xs leading-relaxed">
                      {contact.raw_address}
                    </dd>
                  </div>
                )}

                {contact.language && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <Languages className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd className="text-[var(--text-primary)]">{contact.language}</dd>
                  </div>
                )}

                <div className="border-t border-[var(--border-subtle)] my-2" />

                {/* Ministry */}
                {contact.watched_program && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <Tv className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd className="text-[var(--text-primary)]">
                      Watched Program
                      {contact.program_name && (
                        <span className="text-[var(--text-secondary)]"> — {contact.program_name}</span>
                      )}
                    </dd>
                  </div>
                )}

                {contact.want_prayer && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <Heart className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd className="text-[var(--text-primary)]">
                      Prayer Request
                      {contact.prayer_day_time && (
                        <span className="text-[var(--text-secondary)]"> — {contact.prayer_day_time}</span>
                      )}
                    </dd>
                  </div>
                )}

                {contact.want_ror_daily && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <BookOpen className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd className="text-[var(--text-primary)]">Receives ROR Daily</dd>
                  </div>
                )}

                {/* Cell Group */}
                {(contact.cell_group_name || contact.cell_group_leader) && (
                  <>
                    <div className="border-t border-[var(--border-subtle)] my-2" />
                    {contact.cell_group_name && (
                      <div className="flex gap-3">
                        <dt className="shrink-0">
                          <Users className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                        </dt>
                        <dd className="text-[var(--text-primary)]">{contact.cell_group_name}</dd>
                      </div>
                    )}
                    {contact.cell_group_leader && (
                      <div className="flex gap-3">
                        <dt className="shrink-0">
                          <User className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                        </dt>
                        <dd className="text-[var(--text-secondary)]">Leader: {contact.cell_group_leader}</dd>
                      </div>
                    )}
                  </>
                )}

                <div className="border-t border-[var(--border-subtle)] my-2" />

                {/* Agent / Source / Timestamps */}
                {contact.agent && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <User className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd>
                      <span className="text-[var(--text-muted)] text-xs">Assigned Agent</span>
                      <span className="block text-[var(--text-primary)] font-medium">{contact.agent.full_name}</span>
                    </dd>
                  </div>
                )}

                {contact.source && (
                  <div className="flex gap-3">
                    <dt className="shrink-0">
                      <Tag className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                    </dt>
                    <dd>
                      <span className="text-[var(--text-muted)] text-xs">Source</span>
                      <span className="block text-[var(--text-primary)]">{contact.source}</span>
                    </dd>
                  </div>
                )}

                <div className="flex gap-3">
                  <dt className="shrink-0">
                    <CalendarDays className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                  </dt>
                  <dd>
                    <span className="text-[var(--text-muted)] text-xs">Created</span>
                    <span className="block text-[var(--text-secondary)]">
                      {new Date(contact.created_at).toLocaleDateString('en-IN', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </span>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {contact.notes && (
            <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <StickyNote className="h-4 w-4 text-[var(--gold-400)]" />
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    Notes
                  </h3>
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap bg-black/20 p-3 rounded-lg border border-[var(--border-subtle)]">
                  {contact.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
