'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Papa from 'papaparse'

import DateRangeFilter from './components/DateRangeFilter'
import KpiStrip, { KpiData } from './components/KpiStrip'
import CallAnalytics from './components/CallAnalytics'
import ContactPipeline from './components/ContactPipeline'
import AgentPerformance from './components/AgentPerformance'
import FollowupHealth from './components/FollowupHealth'
import WhatsAppAnalytics from './components/WhatsAppAnalytics'
import GeographicInsights from './components/GeographicInsights'

function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export default function AnalyticsClient() {
  const supabase = createClient()
  const { profile, loading: userLoading } = useUser()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activePreset, setActivePreset] = useState('30d')

  // Raw data arrays
  const [callsRaw, setCallsRaw] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [followups, setFollowups] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [waMessages, setWaMessages] = useState<any[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate start & end dates from selected preset
  const getDateRange = useCallback((preset: string): { start: Date | null; end: Date } => {
    const end = new Date()
    if (preset === '7d') {
      const start = new Date()
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    if (preset === '30d') {
      const start = new Date()
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    if (preset === '90d') {
      const start = new Date()
      start.setDate(start.getDate() - 90)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    return { start: null, end } // 'all'
  }, [])

  // Main data fetching
  useEffect(() => {
    if (userLoading || !profile) return

    async function fetchData() {
      setLoading(true)
      try {
        const isAdmin = profile!.role === 'admin' || profile!.role === 'superadmin'
        const agentId = profile!.id
        const { start, end } = getDateRange(activePreset)

        // 1. Calls in period
        let callsQuery = supabase
          .from('calls')
          .select('started_at, duration_secs, outcome, agent_id')
          .lte('started_at', end.toISOString())
          .order('started_at', { ascending: true })

        if (start) {
          callsQuery = callsQuery.gte('started_at', start.toISOString())
        }
        if (!isAdmin) {
          callsQuery = callsQuery.eq('agent_id', agentId)
        }

        // 2. Contacts (overall pipeline snapshot)
        let contactsQuery = supabase
          .from('contacts')
          .select('id, call_status, created_at, source, assigned_agent_id, state, geo_status')
          .order('created_at', { ascending: false })
          .limit(5000)

        if (!isAdmin) {
          contactsQuery = contactsQuery.eq('assigned_agent_id', agentId)
        }

        // 3. Follow-ups in period
        let followupsQuery = supabase
          .from('followups')
          .select('id, due_at, status, created_at, updated_at, agent_id')

        if (start) {
          followupsQuery = followupsQuery.gte('created_at', start.toISOString())
        }
        if (!isAdmin) {
          followupsQuery = followupsQuery.eq('agent_id', agentId)
        }

        // 4. WhatsApp messages
        let waQuery = supabase
          .from('whatsapp_messages')
          .select('template_used, marked_sent_at, created_at, agent_id')
          .order('created_at', { ascending: true })

        if (start) {
          waQuery = waQuery.gte('created_at', start.toISOString())
        }
        if (!isAdmin) {
          waQuery = waQuery.eq('agent_id', agentId)
        }

        // 5. Active agents list (Admin only)
        const agentsPromise = isAdmin
          ? supabase
              .from('profiles')
              .select('id, full_name')
              .eq('is_active', true)
          : Promise.resolve({ data: [] as any[], error: null })

        const [
          callsRes,
          contactsRes,
          followupsRes,
          waRes,
          agentsRes,
        ] = await Promise.all([
          callsQuery,
          contactsQuery,
          followupsQuery,
          waQuery,
          agentsPromise,
        ])

        if (callsRes.error) throw callsRes.error
        if (contactsRes.error) throw contactsRes.error
        if (followupsRes.error) throw followupsRes.error
        if (waRes.error) throw waRes.error
        if (agentsRes.error) throw agentsRes.error

        setCallsRaw(callsRes.data || [])
        setContacts(contactsRes.data || [])
        setFollowups(followupsRes.data || [])
        setWaMessages(waRes.data || [])
        setAgents(agentsRes.data || [])
      } catch (err: any) {
        console.error('Analytics fetch error:', err)
        toast.error('Failed to load analytics datasets.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile, userLoading, activePreset, getDateRange, supabase])

  // Aggregate KPI summary
  const kpiData: KpiData = useMemo(() => {
    const { start } = getDateRange(activePreset)
    const daysInRange = start
      ? Math.max(1, Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)))
      : Math.max(
          1,
          contacts.length > 0
            ? Math.ceil(
                (Date.now() -
                  new Date(contacts[contacts.length - 1]?.created_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 1
        )

    // Average Talk Time (Filtered duration_secs > 0 to avoid distortion)
    const connectedCalls = callsRaw.filter(
      (c) => c.duration_secs !== null && c.duration_secs > 0
    )
    const totalDuration = connectedCalls.reduce(
      (sum, c) => sum + (c.duration_secs || 0),
      0
    )
    const avgSecs =
      connectedCalls.length > 0 ? Math.round(totalDuration / connectedCalls.length) : 0
    const avgTalkTime = formatSeconds(avgSecs)

    // Lifetime Pipeline Conversion
    const connectedContacts = contacts.filter(
      (c) => c.call_status === 'Connected'
    ).length
    const conversionRate =
      contacts.length > 0 ? (connectedContacts / contacts.length) * 100 : 0

    // Follow-ups
    const followupsDone = followups.filter((f) => f.status === 'done').length
    const overdueFollowups = followups.filter(
      (f) => f.status === 'pending' && new Date(f.due_at).getTime() < Date.now()
    ).length

    return {
      totalContacts: contacts.length,
      callsInPeriod: callsRaw.length,
      avgTalkTime,
      avgCallsPerDay: callsRaw.length / daysInRange,
      conversionRate,
      followupsDone,
      overdueFollowups,
      whatsappMessages: waMessages.length,
    }
  }, [callsRaw, contacts, followups, waMessages, activePreset, getDateRange])

  // CSV Export
  const handleExportCsv = useCallback(() => {
    const rows = [
      { Metric: 'Total Contacts', Value: kpiData.totalContacts },
      { Metric: 'Calls in Period', Value: kpiData.callsInPeriod },
      { Metric: 'Avg Talk Time (Connected)', Value: kpiData.avgTalkTime },
      { Metric: 'Avg Calls / Day', Value: kpiData.avgCallsPerDay.toFixed(2) },
      { Metric: 'Pipeline Conversion (%)', Value: `${kpiData.conversionRate.toFixed(2)}%` },
      { Metric: 'Follow-ups Completed', Value: kpiData.followupsDone },
      { Metric: 'Overdue Follow-ups', Value: kpiData.overdueFollowups },
      { Metric: 'WhatsApp Messages Sent', Value: kpiData.whatsappMessages },
    ]

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ministry_analytics_${activePreset}_${
      new Date().toISOString().split('T')[0]
    }.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Analytics summary exported to CSV.')
  }, [kpiData, activePreset])

  if (userLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-400)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Loading analytics insights...
          </p>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics & Performance"
        description={
          isAdmin
            ? 'Organization-wide call statistics, agent performance rankings, and pipeline trends.'
            : 'Your personal outreach metrics, call volume trends, and follow-up completion rates.'
        }
        action={
          <DateRangeFilter
            activePreset={activePreset}
            onPresetChange={setActivePreset}
            onExportCsv={handleExportCsv}
          />
        }
      />

      {/* Section 1: KPI Strip */}
      <KpiStrip data={kpiData} />

      {/* Section 2: Call Analytics (Volume Trend, Outcomes, Peak Hours) */}
      <CallAnalytics callsRaw={callsRaw} mounted={mounted} />

      {/* Section 3: Contact Pipeline (Funnel & Growth) */}
      <ContactPipeline contacts={contacts} mounted={mounted} />

      {/* Section 4: Agent Performance (Admin Only) */}
      {isAdmin && agents.length > 0 && (
        <AgentPerformance
          agents={agents}
          callsRaw={callsRaw}
          contacts={contacts}
          followups={followups}
          mounted={mounted}
        />
      )}

      {/* Section 5: Follow-up Health (Completion & Aging) */}
      <FollowupHealth followups={followups} mounted={mounted} />

      {/* Section 6: WhatsApp Outreach Analytics */}
      <WhatsAppAnalytics messages={waMessages} mounted={mounted} />

      {/* Section 7: Geographic Coverage & Regional Load */}
      <GeographicInsights contacts={contacts} />
    </div>
  )
}
