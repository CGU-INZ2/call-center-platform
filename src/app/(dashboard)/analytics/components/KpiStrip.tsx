'use client'

import React from 'react'
import {
  Users,
  Phone,
  Clock,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'

export interface KpiData {
  totalContacts: number
  callsInPeriod: number
  avgTalkTime: string // e.g. "2m 45s"
  avgCallsPerDay: number
  conversionRate: number // percentage 0-100 (Pipeline conversion)
  followupsDone: number
  overdueFollowups: number
  whatsappMessages: number
}

interface KpiStripProps {
  data: KpiData
}

export default function KpiStrip({ data }: KpiStripProps) {
  const cards = [
    {
      id: 'contacts',
      label: 'Total Contacts',
      value: data.totalContacts.toLocaleString(),
      icon: Users,
      highlight: false,
    },
    {
      id: 'calls',
      label: 'Calls in Period',
      value: data.callsInPeriod.toLocaleString(),
      icon: Phone,
      highlight: false,
    },
    {
      id: 'avgTalkTime',
      label: 'Avg Talk Time (Connected)',
      value: data.avgTalkTime,
      icon: Clock,
      highlight: false,
    },
    {
      id: 'callsPerDay',
      label: 'Avg Calls / Day',
      value: data.avgCallsPerDay.toFixed(1),
      icon: TrendingUp,
      highlight: false,
    },
    {
      id: 'conversion',
      label: 'Pipeline Conversion',
      value: `${data.conversionRate.toFixed(1)}%`,
      icon: Target,
      highlight: false,
    },
    {
      id: 'followupsDone',
      label: 'Follow-ups Completed',
      value: data.followupsDone.toLocaleString(),
      icon: CheckCircle2,
      highlight: false,
    },
    {
      id: 'overdue',
      label: 'Overdue Follow-ups',
      value: data.overdueFollowups.toLocaleString(),
      icon: AlertTriangle,
      highlight: data.overdueFollowups > 0,
      isDanger: data.overdueFollowups > 0,
    },
    {
      id: 'wa',
      label: 'WhatsApp Outreach',
      value: data.whatsappMessages.toLocaleString(),
      icon: MessageSquare,
      highlight: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.id}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[16px] p-5 space-y-2 shadow-sm hover:border-[var(--border-default)]/80 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {card.label}
              </span>
              <div className="p-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--gold-400)]">
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div
              className={`text-2xl font-mono font-medium tracking-tight ${
                card.isDanger ? 'text-[var(--danger)]' : 'text-white'
              }`}
            >
              {card.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}
