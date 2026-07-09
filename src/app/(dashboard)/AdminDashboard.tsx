'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import {
  ChevronRight,
  Loader2,
  ArrowUpRight
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  'New': '#3B82F6',
  'Attempted': '#F59E0B',
  'Connected': '#10B981',
  'Follow-up Required': '#8B5CF6',
  'Not Interested': '#EF4444',
}

const getSingle = (val: any) => {
  if (!val) return null
  return Array.isArray(val) ? val[0] : val
}

interface AgentStat {
  id: string
  name: string
  role: string
  contactsAssigned: number
  callsToday: number
  callsThisWeek: number
  pendingFollowups: number
}

interface ActivityItem {
  id: string
  type: 'call' | 'followup'
  timestamp: string
  agentName: string
  contactName: string
  contactId: string
  title: string
  subtitle: string
  notes: string | null
}

export default function AdminDashboard() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // KPI States
  const [totalContacts, setTotalContacts] = useState(0)
  const [callsToday, setCallsToday] = useState(0)
  const [callsThisWeek, setCallsThisWeek] = useState(0)
  const [needingFollowup, setNeedingFollowup] = useState(0)
  const [prayerRequests, setPrayerRequests] = useState(0)

  // Chart States
  const [callsTrend, setCallsTrend] = useState<{ name: string; count: number }[]>([])
  const [stateChartData, setStateChartData] = useState<{ name: string; count: number }[]>([])
  const [pipelineChartData, setPipelineChartData] = useState<any[]>([])

  // Feed State
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [liveQueue, setLiveQueue] = useState<any[]>([])
  const [recentContacts, setRecentContacts] = useState<any[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true)
      try {
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        const startOfWeek = new Date()
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        startOfWeek.setHours(0, 0, 0, 0)

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        thirtyDaysAgo.setHours(0, 0, 0, 0)

        const [
          contactsCountRes,
          callsTodayRes,
          callsThisWeekRes,
          pendingFollowupsRes,
          profilesRes,
          allContactsRes,
          trendCallsRes,
          latestCallsRes,
          latestFollowupsRes
        ] = await Promise.all([
          supabase.from('contacts').select('*', { count: 'exact', head: true }),
          supabase.from('calls').select('*', { count: 'exact', head: true }).gte('started_at', startOfToday.toISOString()),
          supabase.from('calls').select('*', { count: 'exact', head: true }).gte('started_at', startOfWeek.toISOString()),
          supabase.from('followups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('profiles').select('id, full_name, role'),
          supabase.from('contacts').select('id, full_name, created_at, state, call_status, assigned_agent_id').order('created_at', { ascending: false }).limit(100),
          supabase.from('calls').select('started_at, agent_id').gte('started_at', thirtyDaysAgo.toISOString()),
          supabase.from('calls').select('id, started_at, outcome, notes, agent:profiles(full_name), contact:contacts(id, full_name, phone, state)').order('started_at', { ascending: false }).limit(10),
          supabase.from('followups').select('id, created_at, due_at, status, notes, agent:profiles(full_name), contact:contacts(id, full_name)').order('created_at', { ascending: false }).limit(10)
        ])

        setTotalContacts(contactsCountRes.count || 0)
        setCallsToday(callsTodayRes.count || 0)
        setCallsThisWeek(callsThisWeekRes.count || 0)
        setNeedingFollowup(pendingFollowupsRes.count || 0)

        const profiles = profilesRes.data || []
        const contacts = allContactsRes.data || []
        const trendCalls = trendCallsRes.data || []

        setRecentContacts(contacts.slice(0, 5))

        // Calls Trend Chart
        const trendMap: Record<string, number> = {}
        for (let i = 29; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = d.toISOString().split('T')[0]
          trendMap[key] = 0
        }
        trendCalls.forEach((call) => {
          try {
            const key = call.started_at.split('T')[0]
            if (trendMap[key] !== undefined) {
              trendMap[key]++
            }
          } catch (e) {}
        })
        const formattedTrend = Object.keys(trendMap).map((key) => {
          const date = new Date(key)
          const name = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return { name, count: trendMap[key] }
        })
        setCallsTrend(formattedTrend)

        // Contacts by State
        const stateCounts: Record<string, number> = {}
        contacts.forEach((c) => {
          const state = c.state ? c.state.trim() : 'Unspecified'
          stateCounts[state] = (stateCounts[state] || 0) + 1
        })
        const formattedStates = Object.keys(stateCounts)
          .map((state) => ({ name: state, count: stateCounts[state] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
        setStateChartData(formattedStates)

        const agents = profiles.filter((p) => p.role === 'agent' || p.role === 'admin')
        const pipelineData = agents.map((agent) => {
          const stats = {
            name: agent.full_name || 'Unnamed Agent',
            'New': 0,
            'Attempted': 0,
            'Connected': 0,
            'Follow-up Required': 0,
            'Not Interested': 0,
          }
          contacts.forEach((c) => {
            if (c.assigned_agent_id === agent.id) {
              const status = (c.call_status || 'New') as keyof typeof stats
              if (stats[status] !== undefined) {
                (stats[status] as number)++
              }
            }
          })
          return stats
        }).filter((item) => {
          const total = item.New + item.Attempted + item.Connected + item['Follow-up Required'] + item['Not Interested']
          return total > 0
        })
        setPipelineChartData(pipelineData)

        const feedItems: ActivityItem[] = []
        if (latestCallsRes.data) {
          // Mock Live Queue using recent calls
          setLiveQueue(latestCallsRes.data.slice(0, 3).map((call, idx) => ({
            ...call,
            status: idx === 0 ? 'Active' : (idx === 1 ? 'Ringing' : 'On Hold'),
            timer: idx === 0 ? '03:42' : (idx === 1 ? '00:15' : '01:20')
          })))

          latestCallsRes.data.forEach((call) => {
            const callAgent = getSingle(call.agent)
            const callContact = getSingle(call.contact)
            const agentName = callAgent?.full_name || 'System'
            const contactName = callContact?.full_name || 'Unknown Contact'
            const contactId = callContact?.id || ''
            feedItems.push({
              id: call.id,
              type: 'call',
              timestamp: call.started_at,
              agentName,
              contactName,
              contactId,
              title: `${agentName} called ${contactName}`,
              subtitle: `Outcome: ${call.outcome ? call.outcome.replace('_', ' ') : 'N/A'}`,
              notes: call.notes,
            })
          })
        }

        if (latestFollowupsRes.data) {
          latestFollowupsRes.data.forEach((f) => {
            const followupAgent = getSingle(f.agent)
            const followupContact = getSingle(f.contact)
            const agentName = followupAgent?.full_name || 'System'
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
              agentName,
              contactName,
              contactId,
              title: `${agentName} scheduled follow-up for ${contactName}`,
              subtitle: `Due: ${formattedDue} (${f.status})`,
              notes: f.notes,
            })
          })
        }

        feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setActivities(feedItems.slice(0, 10))

      } catch (err: any) {
        console.error('Error fetching admin stats:', err)
        toast.error('Failed to load global administration dashboard.')
      } finally {
        setLoading(false)
      }
    }

    fetchAdminData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-500)]" />
          <p className="text-sm text-[var(--text-secondary)]">Loading administration insights...</p>
        </div>
      </div>
    )
  }

  // Find max count for progress bars
  const maxStateCount = Math.max(...stateChartData.map(s => s.count), 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Monitor organization-wide metrics, agent performance, and follow-up pipeline."
      />

      {/* Hero Row: Live Queue & Regional Load */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Queue */}
        <Card className="lg:col-span-2 bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold text-white">Live Queue</CardTitle>
            <span className="bg-[var(--success-muted)]/30 text-[var(--success)] px-2.5 py-0.5 rounded-md text-xs font-semibold border border-[var(--success)]/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] dot-pulse-green"></span>
              {liveQueue.length} Active
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {liveQueue.length > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {liveQueue.map((call) => {
                  const contact = getSingle(call.contact)
                  const isGreen = call.status === 'Active'
                  const isYellow = call.status === 'On Hold'
                  return (
                    <div key={call.id} className="flex items-center justify-between px-6 py-4 hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="font-medium text-white">{contact?.phone || contact?.full_name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${
                          isGreen ? 'bg-[var(--success-muted)]/30 text-[var(--success)] border-[var(--success)]/20' :
                          isYellow ? 'bg-[var(--warning-muted)]/30 text-[var(--warning)] border-[var(--warning)]/20' :
                          'bg-[var(--info-muted)]/30 text-[var(--info)] border-[var(--info)]/20'
                        }`}>
                          {call.status}
                        </span>
                        <div className="text-xs text-[var(--text-secondary)]">{contact?.state || 'Unknown'}</div>
                      </div>
                      <div className="font-mono text-white text-sm font-medium">{call.timer}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-sm text-[var(--text-muted)] text-center">No active calls in queue.</div>
            )}
          </CardContent>
        </Card>

        {/* Regional Load */}
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold text-white">Regional Load</CardTitle>
            <Link href="/analytics" className="text-xs font-semibold text-[var(--gold-400)] hover:text-[var(--gold-300)] flex items-center">
              View analytics <ArrowUpRight className="ml-0.5 w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0 space-y-4">
            {stateChartData.length > 0 ? stateChartData.map((state, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-primary)] font-medium">{state.name}</span>
                  <span className="font-mono text-[var(--text-secondary)]">{state.count}</span>
                </div>
                <div className="h-[5px] w-full bg-[#22252f] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[var(--gold-400)] rounded-full" 
                    style={{ width: `${(state.count / maxStateCount) * 100}%` }}
                  />
                </div>
              </div>
            )) : (
              <div className="text-sm text-[var(--text-muted)] text-center py-4">No regional data.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compact Stat Strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[16px] flex items-center divide-x divide-[var(--border-subtle)] shadow-sm">
        <div className="flex-1 p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Calls Today</div>
          <div className="text-2xl font-mono text-white font-medium">{callsToday}</div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Total Contacts</div>
          <div className="text-2xl font-mono text-white font-medium">{totalContacts}</div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Pending Follow-ups</div>
          <div className="text-2xl font-mono text-white font-medium">{needingFollowup}</div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Prayer Requests</div>
          <div className="text-2xl font-mono text-white font-medium">{prayerRequests}</div>
        </div>
      </div>

      {/* Recent Contacts Table */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-white">Recent Contacts</CardTitle>
          <Link href="/contacts" className="text-xs font-semibold text-[var(--gold-400)] hover:text-[var(--gold-300)] flex items-center">
            View all <ArrowUpRight className="ml-0.5 w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm zebra-rows">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="px-6 py-3 text-xs font-medium text-[var(--text-muted)]">Name</th>
                <th className="px-6 py-3 text-xs font-medium text-[var(--text-muted)]">Region</th>
                <th className="px-6 py-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                <th className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-6 py-3 text-white font-medium">{contact.full_name || 'Unnamed'}</td>
                  <td className="px-6 py-3 text-[var(--text-secondary)]">{contact.state || '-'}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-md font-semibold border bg-[var(--border-default)] text-[var(--text-muted)]">
                      {contact.call_status || 'New'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/contacts/${contact.id}`} className="text-xs font-semibold text-[var(--gold-400)] hover:text-white transition-colors">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white">Call Volume Trend</CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Total logged calls per day over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pr-4">
            {mounted && callsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={callsTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--gold-400)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--gold-400)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                No call volume trend data available.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white">Status Pipeline by Agent</CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Breakdown of contact status assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pr-4">
            {mounted && pipelineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                  />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="New" stackId="a" fill={STATUS_COLORS['New']} />
                  <Bar dataKey="Attempted" stackId="a" fill={STATUS_COLORS['Attempted']} />
                  <Bar dataKey="Connected" stackId="a" fill={STATUS_COLORS['Connected']} />
                  <Bar dataKey="Follow-up Required" stackId="a" fill={STATUS_COLORS['Follow-up Required']} />
                  <Bar dataKey="Not Interested" stackId="a" fill={STATUS_COLORS['Not Interested']} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                No active contact pipelines to display.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-white">Organization Activity</CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Latest events logged across the organization
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {activities.length > 0 ? (
            <div className="divide-y divide-[var(--border-subtle)]">
              {activities.map((act) => (
                <div key={act.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white line-clamp-1">{act.title}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{act.subtitle}</p>
                      {act.notes && (
                        <p className="text-xs text-[var(--text-muted)] italic max-w-2xl line-clamp-1 mt-1">
                          "{act.notes}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-[var(--text-muted)]">
                        {mounted ? formatDistanceToNow(parseISO(act.timestamp), { addSuffix: true }) : ''}
                      </span>
                      {act.contactId && (
                        <Link
                          href={`/contacts/${act.contactId}`}
                          className="p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              No organization activities found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
