'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow, parseISO, isToday, isPast, addDays, startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Phone,
  RefreshCw,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'

// ─── Types ────────────────────────────────────────────────────────────────────
interface FollowupContact {
  id: string
  full_name: string
  phone: string | null
  call_status: string | null
}

interface FollowupAgent {
  full_name: string
}

export interface Followup {
  id: string
  due_at: string
  status: 'pending' | 'done' | 'missed'
  notes: string | null
  created_at: string
  contact: FollowupContact | null
  agent: FollowupAgent | null
}

interface FollowupsClientProps {
  followups: Followup[]
  userRole: 'admin' | 'agent'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDue(dueAt: string): string {
  try {
    const d = parseISO(dueAt)
    if (isToday(d)) return 'Today'
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}

function getSectionColor(section: 'overdue' | 'today' | 'upcoming') {
  switch (section) {
    case 'overdue':  return 'var(--danger)'
    case 'today':    return 'var(--gold-400)'
    case 'upcoming': return 'var(--info)'
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FollowupsClient({ followups: initialFollowups, userRole }: FollowupsClientProps) {
  const supabase = createClient()
  const [items, setItems] = useState<Followup[]>(initialFollowups)
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [rescheduleDateValue, setRescheduleDateValue] = useState<string>('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ── Auto-mark 3+ days overdue as missed on mount ──────────────────────────
  useEffect(() => {
    const cutoff = addDays(new Date(), -3)
    const toMiss = items.filter(
      (f) => isPast(parseISO(f.due_at)) && parseISO(f.due_at) < cutoff && f.status === 'pending'
    )

    if (toMiss.length > 0) {
      supabase
        .from('followups')
        .update({ status: 'missed' })
        .in('id', toMiss.map((f) => f.id))
        .then(({ error }) => {
          if (error) {
            console.error('Failed to auto-mark missed:', error.message)
          } else {
            // Filter out from local state silently
            setItems((prev) => prev.filter((f) => !toMiss.find((m) => m.id === f.id)))
          }
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Grouping ──────────────────────────────────────────────────────────────
  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)

  const overdue  = items.filter((f) => parseISO(f.due_at) < today)
  const dueToday = items.filter((f) => {
    const d = startOfDay(parseISO(f.due_at))
    return d.getTime() === today.getTime()
  })
  const upcoming = items.filter((f) => parseISO(f.due_at) >= tomorrow)

  // ── Mark Done ─────────────────────────────────────────────────────────────
  const handleMarkDone = async (id: string) => {
    setProcessingId(id)
    const { error } = await supabase
      .from('followups')
      .update({ status: 'done' })
      .eq('id', id)

    if (error) {
      toast.error('Failed to mark as done. Please try again.')
    } else {
      setItems((prev) => prev.filter((f) => f.id !== id))
      toast.success('Follow-up marked as done')
    }
    setProcessingId(null)
  }

  // ── Reschedule ────────────────────────────────────────────────────────────
  const handleReschedule = async (id: string) => {
    if (!rescheduleDateValue) {
      toast.error('Please pick a date first.')
      return
    }
    setProcessingId(id)
    const newDueAt = new Date(rescheduleDateValue).toISOString()
    const { error } = await supabase
      .from('followups')
      .update({ due_at: newDueAt, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error('Failed to reschedule. Please try again.')
    } else {
      setItems((prev) =>
        prev.map((f) => f.id === id ? { ...f, due_at: newDueAt } : f)
          .sort((a, b) => parseISO(a.due_at).getTime() - parseISO(b.due_at).getTime())
      )
      setReschedulingId(null)
      setRescheduleDateValue('')
      toast.success('Follow-up rescheduled')
    }
    setProcessingId(null)
  }

  // ── Render a single follow-up card ────────────────────────────────────────
  const renderCard = (f: Followup, section: 'overdue' | 'today' | 'upcoming') => {
    const borderColor = getSectionColor(section)
    const isProcessing = processingId === f.id
    const isRescheduling = reschedulingId === f.id

    return (
      <div
        key={f.id}
        className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg overflow-hidden shadow-sm hover:border-[var(--border-subtle)] transition-all"
        style={{ borderLeft: `3px solid ${borderColor}` }}
      >
        <div className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              {f.contact ? (
                <Link
                  href={`/contacts/${f.contact.id}`}
                  className="text-sm font-semibold text-white hover:text-[var(--gold-300)] transition-colors hover:underline underline-offset-2"
                >
                  {f.contact.full_name}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-[var(--text-muted)]">
                  Unknown Contact
                </span>
              )}
              {f.contact?.phone && (
                <p className="text-xs text-[var(--text-secondary)]">{f.contact.phone}</p>
              )}
              {userRole === 'admin' && f.agent && (
                <p className="text-xs text-[var(--text-muted)]">
                  Agent: <span className="text-white/70">{f.agent.full_name}</span>
                </p>
              )}
            </div>

            {/* Due date badge */}
            <div
              className="flex items-center gap-1 text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full border"
              style={{ color: borderColor, borderColor: `${borderColor}30`, background: `${borderColor}10` }}
            >
              <Clock className="h-3 w-3" />
              {formatDue(f.due_at)}
            </div>
          </div>

          {/* Notes */}
          {f.notes && (
            <p className="text-sm text-[var(--text-secondary)] line-clamp-2 pl-2 border-l-2 border-[var(--border-subtle)]">
              {f.notes}
            </p>
          )}

          {/* Reschedule date picker (inline, conditional) */}
          {isRescheduling && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                type="date"
                value={rescheduleDateValue}
                onChange={(e) => setRescheduleDateValue(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 rounded-md bg-[var(--bg-root)] border border-[var(--border-default)] text-[var(--text-primary)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--gold-500)] focus:ring-2 focus:ring-[var(--gold-500)]/20 transition-colors"
              />
              <Button
                size="sm"
                disabled={isProcessing || !rescheduleDateValue}
                onClick={() => handleReschedule(f.id)}
                className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] text-[var(--text-inverse)] font-semibold text-xs hover:opacity-90"
              >
                {isProcessing ? '…' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setReschedulingId(null); setRescheduleDateValue('') }}
                className="text-[var(--text-secondary)] hover:text-white text-xs"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Action row */}
          {!isRescheduling && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                disabled={isProcessing}
                onClick={() => handleMarkDone(f.id)}
                className="gap-1.5 text-xs h-7 px-3 bg-[var(--success)]/10 border border-[var(--success)]/20 text-[var(--success)] hover:bg-[var(--success)]/20"
                variant="outline"
              >
                <Check className="h-3 w-3" />
                Mark Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => { setReschedulingId(f.id); setRescheduleDateValue('') }}
                className="gap-1.5 text-xs h-7 px-3 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <RefreshCw className="h-3 w-3" />
                Reschedule
              </Button>
              {f.contact?.phone && (
                <a
                  href={`tel:${f.contact.phone}`}
                  className="inline-flex items-center gap-1.5 text-xs h-7 px-3 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors font-medium"
                >
                  <Phone className="h-3 w-3" />
                  Call Now
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render a labelled section ─────────────────────────────────────────────
  const renderSection = (
    label: string,
    sectionItems: Followup[],
    section: 'overdue' | 'today' | 'upcoming',
    icon: React.ElementType
  ) => {
    if (sectionItems.length === 0) return null
    const color = getSectionColor(section)
    const Icon = icon

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" style={{ color }} />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
            {label}
          </h2>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${color}20`, color }}
          >
            {sectionItems.length}
          </span>
        </div>
        <div className="space-y-3">
          {sectionItems.map((f) => renderCard(f, section))}
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Track and manage your pending follow-up calls"
      />

      {/* Stat header cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[var(--danger)]/10 border border-[var(--danger)]/20 shrink-0">
              <AlertCircle className="h-5 w-5 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--danger)]">{overdue.length}</p>
              <p className="text-xs text-[var(--text-secondary)] font-medium">Overdue</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[var(--gold-400)]/10 border border-[var(--gold-400)]/20 shrink-0">
              <Clock className="h-5 w-5 text-[var(--gold-400)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--gold-400)]">{dueToday.length}</p>
              <p className="text-xs text-[var(--text-secondary)] font-medium">Due Today</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[var(--info)]/10 border border-[var(--info)]/20 shrink-0">
              <Calendar className="h-5 w-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--info)]">{upcoming.length}</p>
              <p className="text-xs text-[var(--text-secondary)] font-medium">Upcoming</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Follow-up sections or empty state */}
      {items.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl">🎉</span>
          <p className="mt-3 text-[var(--text-secondary)]">All caught up! No pending follow-ups.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {renderSection('Overdue', overdue, 'overdue', AlertCircle)}
          {renderSection('Due Today', dueToday, 'today', Clock)}
          {renderSection('Upcoming', upcoming, 'upcoming', CheckCircle2)}
        </div>
      )}
    </div>
  )
}
