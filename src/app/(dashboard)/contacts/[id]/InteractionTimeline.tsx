'use client'

import React from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import {
  Phone,
  Calendar,
  MessageSquare,
  Heart,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react'

export interface TimelineEvent {
  id: string
  type: 'call' | 'followup' | 'whatsapp' | 'prayer'
  timestamp: string // ISO string
  notes?: string | null
  agentName?: string
  callOutcome?: string | null
  callDuration?: number | null
  callNextAction?: string | null
  followupDueAt?: string | null
  followupStatus?: 'pending' | 'done' | 'missed' | null
  whatsappTemplate?: string | null
  whatsappBody?: string | null
  prayerType?: 'prayer' | 'testimony' | null
  prayerContent?: string | null
}

interface InteractionTimelineProps {
  events: TimelineEvent[]
}

const getEventStyles = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'call':
      return {
        icon: Phone,
        colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        title: 'Phone Call'
      }
    case 'followup':
      return {
        icon: Calendar,
        colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        title: 'Follow-up Task'
      }
    case 'whatsapp':
      return {
        icon: MessageSquare,
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        title: 'WhatsApp Message'
      }
    case 'prayer':
      return {
        icon: Heart,
        colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        title: 'Prayer Request'
      }
    default:
      return {
        icon: HelpCircle,
        colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
        title: 'Interaction'
      }
  }
}

const formatOutcome = (outcome: string) => {
  return outcome
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const formatDuration = (secs: number) => {
  const mins = Math.floor(secs / 60)
  const remainingSecs = secs % 60
  if (mins > 0) {
    return `${mins}m ${remainingSecs}s`
  }
  return `${remainingSecs}s`
}

export default function InteractionTimeline({ events }: InteractionTimelineProps) {
  if (events.length === 0) {
    return (
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
        <CardContent className="p-8 text-center text-[var(--text-secondary)]">
          <Clock className="mx-auto h-8 w-8 text-[var(--text-muted)] mb-3" />
          <p className="text-sm">No interactions recorded yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-[2px] before:bg-[var(--border-default)]">
      {events.map((event) => {
        const styles = getEventStyles(event.type)
        const Icon = styles.icon
        let dateObj: Date
        let relativeTime = 'unknown time'
        try {
          dateObj = parseISO(event.timestamp)
          relativeTime = formatDistanceToNow(dateObj, { addSuffix: true })
        } catch (e) {
          console.error('Invalid timestamp:', event.timestamp)
        }

        return (
          <div key={event.id} className="relative group animate-in fade-in slide-in-from-left-2 duration-200">
            {/* Timeline Dot Indicator */}
            <div className={`absolute -left-[27px] top-1.5 h-6.5 w-6.5 rounded-full border flex items-center justify-center ${styles.colorClass} shadow-md`}>
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Event Card */}
            <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-default)]/60 transition-colors shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{styles.title}</span>
                    {event.agentName && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        by <span className="font-semibold text-white/80">{event.agentName}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] select-none">
                    {relativeTime}
                  </span>
                </div>

                {/* Event specific details */}
                {event.type === 'call' && (
                  <div className="grid grid-cols-2 gap-2 text-xs bg-black/20 p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    <div>
                      <span className="text-[var(--text-secondary)] block">Outcome</span>
                      <span className={`font-semibold ${
                        event.callOutcome === 'answered' || event.callOutcome === 'prayer_request'
                          ? 'text-[var(--success)]'
                          : event.callOutcome === 'busy' || event.callOutcome === 'callback_requested'
                          ? 'text-[var(--warning)]'
                          : 'text-[var(--text-secondary)]'
                      }`}>
                        {event.callOutcome ? formatOutcome(event.callOutcome) : 'No Outcome Recorded'}
                      </span>
                    </div>
                    {event.callDuration && (
                      <div>
                        <span className="text-[var(--text-secondary)] block">Duration</span>
                        <span className="font-mono font-semibold text-white">
                          {formatDuration(event.callDuration)}
                        </span>
                      </div>
                    )}
                    {event.callNextAction && (
                      <div className="col-span-2 border-t border-[var(--border-subtle)]/50 pt-1.5 mt-1.5">
                        <span className="text-[var(--text-secondary)] block">Next Action Plan</span>
                        <span className="text-white font-medium">{event.callNextAction}</span>
                      </div>
                    )}
                  </div>
                )}

                {event.type === 'followup' && (
                  <div className="flex items-center justify-between gap-3 text-xs bg-black/20 p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    <div className="space-y-0.5">
                      <span className="text-[var(--text-secondary)] block">Due Date</span>
                      <span className="font-semibold text-white">
                        {new Date(event.followupDueAt || '').toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {event.followupStatus === 'done' ? (
                        <span className="flex items-center gap-1 text-[var(--success)] font-semibold bg-[var(--success-muted)]/20 px-2 py-0.5 rounded border border-[var(--success)]/20">
                          <CheckCircle2 className="h-3 w-3" />
                          Done
                        </span>
                      ) : event.followupStatus === 'missed' ? (
                        <span className="flex items-center gap-1 text-[var(--danger)] font-semibold bg-[var(--danger-muted)]/20 px-2 py-0.5 rounded border border-[var(--danger)]/20">
                          <AlertCircle className="h-3 w-3" />
                          Missed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[var(--warning)] font-semibold bg-[var(--warning-muted)]/20 px-2 py-0.5 rounded border border-[var(--warning)]/20">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {event.type === 'whatsapp' && (
                  <div className="space-y-1.5 text-xs bg-black/20 p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    {event.whatsappTemplate && (
                      <div>
                        <span className="text-[var(--text-secondary)] block">Template</span>
                        <span className="font-mono text-white font-semibold">{event.whatsappTemplate}</span>
                      </div>
                    )}
                    {event.whatsappBody && (
                      <div className="pt-1.5 border-t border-[var(--border-subtle)]/50">
                        <span className="text-[var(--text-secondary)] block mb-1">Message Content</span>
                        <p className="text-white bg-black/30 p-2 rounded border border-[var(--border-subtle)] whitespace-pre-wrap">
                          {event.whatsappBody}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {event.type === 'prayer' && (
                  <div className="space-y-1.5 text-xs bg-black/20 p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    <div>
                      <span className="text-[var(--text-secondary)] block">Type</span>
                      <span className={`font-semibold capitalize px-2 py-0.5 rounded border inline-block ${
                        event.prayerType === 'testimony'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                      }`}>
                        {event.prayerType || 'Prayer'}
                      </span>
                    </div>
                    {event.prayerContent && (
                      <div className="pt-1.5 border-t border-[var(--border-subtle)]/50">
                        <span className="text-[var(--text-secondary)] block mb-1">Request Detail</span>
                        <p className="text-white bg-black/30 p-2 rounded border border-[var(--border-subtle)] whitespace-pre-wrap italic">
                          "{event.prayerContent}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Event Notes (if applicable, separate from content details) */}
                {event.notes && event.type !== 'whatsapp' && event.type !== 'prayer' && (
                  <p className="text-sm text-[var(--text-primary)] pl-1 border-l-2 border-[var(--gold-400)]/40 italic">
                    {event.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
