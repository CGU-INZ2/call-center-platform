'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import {
  Users,
  UserPlus,
  Phone,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  ChevronRight,
  PhoneCall,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

// ─── Status Color Configuration ───────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'New': '#3B82F6',               // Blue
  'Attempted': '#F59E0B',         // Yellow
  'Connected': '#10B981',         // Green
  'Follow-up Required': '#8B5CF6',// Purple
  'Not Interested': '#EF4444',    // Red
}

const getSingle = (val: any) => {
  if (!val) return null
  return Array.isArray(val) ? val[0] : val
}

interface ActivityItem {
  id: string
  type: 'call' | 'followup'
  timestamp: string
  contactName: string
  contactId: string
  title: string
  subtitle: string
  notes: string | null
}

export default function AgentDashboard() {
  const supabase = createClient()
  const { profile } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)

  const handleTakeContact = async () => {
    if (!profile?.id) return
    setIsLoadingNext(true)

    try {
      // 1. Fetch oldest pending follow-up (overdue or due)
      const { data: followupData, error: fuError } = await supabase
        .from('followups')
        .select('contact_id')
        .eq('agent_id', profile.id)
        .eq('status', 'pending')
        .order('due_at', { ascending: true })
        .limit(1)

      if (fuError) throw fuError

      if (followupData && followupData.length > 0) {
        toast.success('Routing to your next pending follow-up!')
        router.push(`/contacts/${followupData[0].contact_id}`)
        return
      }

      // 2. Fetch oldest New contact
      const { data: newContact, error: newErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('assigned_agent_id', profile.id)
        .eq('call_status', 'New')
        .order('created_at', { ascending: true })
        .limit(1)

      if (newErr) throw newErr

      if (newContact && newContact.length > 0) {
        toast.success('Routing to next new contact!')
        router.push(`/contacts/${newContact[0].id}`)
        return
      }

      // 3. Fetch oldest Attempted contact (retry)
      const { data: attemptedContact, error: attErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('assigned_agent_id', profile.id)
        .eq('call_status', 'Attempted')
        .order('last_contacted_at', { ascending: true })
        .limit(1)

      if (attErr) throw attErr

      if (attemptedContact && attemptedContact.length > 0) {
        toast.success('Routing to next retry contact!')
        router.push(`/contacts/${attemptedContact[0].id}`)
        return
      }

      toast.info('All caught up! No pending follow-ups or contacts left in your queue.')
    } catch (err: any) {
      console.error('Error fetching next contact:', err)
      toast.error('Failed to retrieve the next contact.')
    } finally {
      setIsLoadingNext(false)
    }
  }

  // KPI States
  const [myContactsCount, setMyContactsCount] = useState(0)
  const [callsTodayCount, setCallsTodayCount] = useState(0)
  const [pendingFollowupsCount, setPendingFollowupsCount] = useState(0)
  const [overdueFollowupsCount, setOverdueFollowupsCount] = useState(0)

  // Chart States
  const [weeklyCalls, setWeeklyCalls] = useState<{ name: string; count: number }[]>([])
  const [statusDist, setStatusDist] = useState<{ name: string; value: number; color: string }[]>([])

  // Feed State
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!profile?.id) return

    async function fetchDashboardData() {
      setLoading(true)
      try {
        const agentId = profile!.id

        // 1. My Contacts Count
        const { count: contactsCount, error: contactsErr } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_agent_id', agentId)
        if (contactsErr) throw contactsErr
        setMyContactsCount(contactsCount || 0)

        // 2. Calls Today
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const { count: callsToday, error: callsTodayErr } = await supabase
          .from('calls')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .gte('started_at', startOfToday.toISOString())
        if (callsTodayErr) throw callsTodayErr
        setCallsTodayCount(callsToday || 0)

        // 3. Pending Follow-ups (due_at in future, status = pending)
        const { count: pendingCount, error: pendingErr } = await supabase
          .from('followups')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .eq('status', 'pending')
          .gte('due_at', new Date().toISOString())
        if (pendingErr) throw pendingErr
        setPendingFollowupsCount(pendingCount || 0)

        // 4. Overdue Follow-ups (due_at in past, status = pending)
        const { count: overdueCount, error: overdueErr } = await supabase
          .from('followups')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .eq('status', 'pending')
          .lt('due_at', new Date().toISOString())
        if (overdueErr) throw overdueErr
        setOverdueFollowupsCount(overdueCount || 0)

        // 5. Last 7 Days Calls (Bar Chart)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        const { data: callsWeeklyData, error: weeklyErr } = await supabase
          .from('calls')
          .select('started_at')
          .eq('agent_id', agentId)
          .gte('started_at', sevenDaysAgo.toISOString())
        if (weeklyErr) throw weeklyErr

        // Build weekday structure
        const daysMap: Record<string, number> = {}
        const dayLabels: string[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const label = d.toLocaleDateString('en-US', { weekday: 'short' })
          daysMap[label] = 0
          dayLabels.push(label)
        }

        if (callsWeeklyData) {
          callsWeeklyData.forEach((call) => {
            try {
              const callDate = new Date(call.started_at)
              const label = callDate.toLocaleDateString('en-US', { weekday: 'short' })
              if (daysMap[label] !== undefined) {
                daysMap[label]++
              }
            } catch (e) {
              console.error('Error parsing call date:', e)
            }
          })
        }

        setWeeklyCalls(dayLabels.map((lbl) => ({ name: lbl, count: daysMap[lbl] })))

        // 6. Contact Status Distribution (Donut Chart)
        const { data: contactsStatusData, error: statusErr } = await supabase
          .from('contacts')
          .select('call_status')
          .eq('assigned_agent_id', agentId)
        if (statusErr) throw statusErr

        const distMap: Record<string, number> = {
          'New': 0,
          'Attempted': 0,
          'Connected': 0,
          'Follow-up Required': 0,
          'Not Interested': 0,
        }

        if (contactsStatusData) {
          contactsStatusData.forEach((c) => {
            const status = c.call_status || 'New'
            if (distMap[status] !== undefined) {
              distMap[status]++
            } else {
              distMap[status] = (distMap[status] || 0) + 1
            }
          })
        }

        const formattedDist = Object.keys(distMap)
          .map((statusName) => ({
            name: statusName,
            value: distMap[statusName],
            color: STATUS_COLORS[statusName] || '#6B7280',
          }))
          .filter((item) => item.value > 0)

        setStatusDist(formattedDist)

        // 7. Recent Agent Activity Feed (Latest 10 calls + followups)
        const { data: latestCalls, error: latestCallsErr } = await supabase
          .from('calls')
          .select('id, started_at, outcome, notes, contact:contacts(id, full_name)')
          .eq('agent_id', agentId)
          .order('started_at', { ascending: false })
          .limit(10)
        if (latestCallsErr) throw latestCallsErr

        const { data: latestFollowups, error: latestFollowupsErr } = await supabase
          .from('followups')
          .select('id, created_at, due_at, status, notes, contact:contacts(id, full_name)')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: false })
          .limit(10)
        if (latestFollowupsErr) throw latestFollowupsErr

        const feedItems: ActivityItem[] = []

        if (latestCalls) {
          latestCalls.forEach((call) => {
            const callContact = getSingle(call.contact)
            const contactName = callContact?.full_name || 'Unknown Contact'
            const contactId = callContact?.id || ''
            feedItems.push({
              id: call.id,
              type: 'call',
              timestamp: call.started_at,
              contactName,
              contactId,
              title: `Logged a call with ${contactName}`,
              subtitle: `Outcome: ${call.outcome ? call.outcome.replace('_', ' ') : 'N/A'}`,
              notes: call.notes,
            })
          })
        }

        if (latestFollowups) {
          latestFollowups.forEach((f) => {
            const followupContact = getSingle(f.contact)
            const contactName = followupContact?.full_name || 'Unknown Contact'
            const contactId = followupContact?.id || ''
            const formattedDue = new Date(f.due_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            feedItems.push({
              id: f.id,
              type: 'followup',
              timestamp: f.created_at,
              contactName,
              contactId,
              title: `Scheduled follow-up for ${contactName}`,
              subtitle: `Due: ${formattedDue} (${f.status})`,
              notes: f.notes,
            })
          })
        }

        // Sort combined list descending by timestamp
        feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setActivities(feedItems.slice(0, 10))

      } catch (err: any) {
        console.error('Error fetching agent stats:', err)
        toast.error('Could not fetch agent dashboard statistics.')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [profile?.id])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-500)]" />
          <p className="text-sm text-[var(--text-secondary)]">Loading metrics...</p>
        </div>
      </div>
    )
  }



  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome Back, ${profile?.full_name || 'Agent'}`}
        description="Here is your personal overview of contacts, calls, and follow-ups."
      />

      {/* Prominent Take Next Contact Hero Banner */}
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-elevated)] p-6 sm:p-8 shadow-md">
        {/* Decorative gold glows */}
        <div className="absolute -right-20 -top-20 w-44 h-44 rounded-full bg-[var(--gold-400)]/5 blur-[60px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-44 h-44 rounded-full bg-[var(--gold-400)]/5 blur-[60px] pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Ready for your next outreach?
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-xl leading-relaxed">
              We've prepared your calling queue. Click below to automatically retrieve the next highest priority contact (overdue follow-ups, new leads, or retries).
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={handleTakeContact}
              disabled={isLoadingNext}
              className="group relative flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] bg-[var(--gold-400)] hover:bg-[var(--gold-300)] text-[#0f1117] font-bold dot-pulse-gold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none w-full sm:w-auto overflow-hidden shrink-0"
            >
              {isLoadingNext ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Finding Next Contact...</span>
                </>
              ) : (
                <>
                  <Phone className="h-4.5 w-4.5 fill-current" />
                  <span className="tracking-wide">Take Next Contact</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <Link
              href="/contacts/new"
              className="group flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] border border-[var(--gold-400)]/30 hover:border-[var(--gold-400)] bg-[var(--gold-400)]/5 hover:bg-[var(--gold-400)]/10 text-[var(--gold-400)] hover:text-[var(--gold-300)] font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto shrink-0"
            >
              <UserPlus className="h-4.5 w-4.5" />
              <span className="tracking-wide">Add New Contact</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Compact Stat Strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[16px] flex flex-col sm:flex-row items-center divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)] shadow-sm">
        <div className="flex-1 w-full sm:w-auto p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">My Contacts</div>
          <div className="text-2xl font-mono text-white font-medium">{myContactsCount}</div>
        </div>
        <div className="flex-1 w-full sm:w-auto p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Calls Today</div>
          <div className="text-2xl font-mono text-white font-medium">{callsTodayCount}</div>
        </div>
        <div className="flex-1 w-full sm:w-auto p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Pending Follow-ups</div>
          <div className="text-2xl font-mono text-white font-medium">{pendingFollowupsCount}</div>
        </div>
        <div className="flex-1 w-full sm:w-auto p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Overdue Follow-ups</div>
          <div className={`text-2xl font-mono font-medium ${overdueFollowupsCount > 0 ? 'text-[var(--danger)]' : 'text-white'}`}>
            {overdueFollowupsCount}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Call Trend */}
        <Card className="lg:col-span-2 bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Last 7 Days Call Trend</CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Daily call volume comparison
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pr-4">
            {mounted && weeklyCalls.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyCalls} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-default)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--gold-400)' }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--gold-400)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                No call data available for the last 7 days.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Status Distribution */}
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Status Distribution</CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Assigned contacts status breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] flex flex-col justify-between pb-6">
            {mounted && statusDist.length > 0 ? (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusDist.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-elevated)',
                          borderColor: 'var(--border-default)',
                          borderRadius: '8px',
                        }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs px-2">
                  {statusDist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[var(--text-secondary)] truncate">
                        {item.name}: <span className="font-semibold text-white">{item.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                No contacts assigned yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed Section */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold text-white">Your Recent Activity</CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Your latest call interactions and follow-up activities
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {activities.length > 0 ? (
            <div className="divide-y divide-[var(--border-default)]">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors duration-200"
                >
                  <div className="flex gap-4">
                    <div className="mt-1">
                      {act.type === 'call' ? (
                        <div className="p-2 rounded-lg bg-[var(--gold-700)]/20 text-[var(--gold-400)]">
                          <PhoneCall className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-[var(--success-muted)]/20 text-[var(--success)]">
                          <Calendar className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">{act.title}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{act.subtitle}</p>
                      {act.notes && (
                        <p className="text-xs text-[var(--text-muted)] italic max-w-2xl line-clamp-1">
                          "{act.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {mounted ? formatDistanceToNow(parseISO(act.timestamp), { addSuffix: true }) : ''}
                    </span>
                    {act.contactId && (
                      <Link
                        href={`/contacts/${act.contactId}`}
                        className="p-1 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              No recent activity recorded yet. Keep calling to populate your feed!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
