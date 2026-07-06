'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import {
  Users,
  Phone,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  ChevronRight,
  PhoneCall,
  CheckCircle2,
  MapPin,
  Heart,
  ArrowUpDown,
  TrendingUp,
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
  CartesianGrid,
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
  const [unmappedLocations, setUnmappedLocations] = useState(0)
  const [prayerRequests, setPrayerRequests] = useState(0)

  // Agent Leaderboard States
  const [agentsStats, setAgentsStats] = useState<AgentStat[]>([])
  const [sortBy, setSortBy] = useState<keyof AgentStat>('callsToday')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Chart States
  const [callsTrend, setCallsTrend] = useState<{ name: string; count: number }[]>([])
  const [stateChartData, setStateChartData] = useState<{ name: string; count: number }[]>([])
  const [pipelineChartData, setPipelineChartData] = useState<any[]>([])

  // Feed State
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true)
      try {
        const now = new Date()

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        // Start of current week (Monday)
        const startOfWeek = new Date()
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        startOfWeek.setHours(0, 0, 0, 0)

        // 30 Days ago
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        thirtyDaysAgo.setHours(0, 0, 0, 0)

        // Run queries in parallel
        const [
          contactsCountRes,
          callsTodayRes,
          callsThisWeekRes,
          pendingFollowupsRes,
          unmappedCountRes,
          prayersCountRes,
          profilesRes,
          allContactsRes,
          trendCallsRes,
          latestCallsRes,
          latestFollowupsRes
        ] = await Promise.all([
          // 1. Total Contacts count
          supabase.from('contacts').select('*', { count: 'exact', head: true }),
          // 2. Calls Today count
          supabase.from('calls').select('*', { count: 'exact', head: true }).gte('started_at', startOfToday.toISOString()),
          // 3. Calls This Week count
          supabase.from('calls').select('*', { count: 'exact', head: true }).gte('started_at', startOfWeek.toISOString()),
          // 4. Needing Followup (status = pending)
          supabase.from('followups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          // 5. Unmapped locations count
          supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('geo_status', 'unmapped'),
          // 6. Prayer Requests count
          supabase.from('prayer_requests').select('*', { count: 'exact', head: true }),
          // 7. Profiles (Agents)
          supabase.from('profiles').select('id, full_name, role'),
          // 8. All Contacts (needed for states, pipeline, assignment counts)
          supabase.from('contacts').select('id, assigned_agent_id, state, call_status'),
          // 9. Calls from last 30 days
          supabase.from('calls').select('started_at, agent_id').gte('started_at', thirtyDaysAgo.toISOString()),
          // 10. Latest 10 calls for feed
          supabase.from('calls').select('id, started_at, outcome, notes, agent:profiles(full_name), contact:contacts(id, full_name)').order('started_at', { ascending: false }).limit(10),
          // 11. Latest 10 followups for feed
          supabase.from('followups').select('id, created_at, due_at, status, notes, agent:profiles(full_name), contact:contacts(id, full_name)').order('created_at', { ascending: false }).limit(10)
        ])

        // Check errors
        if (contactsCountRes.error) throw contactsCountRes.error
        if (callsTodayRes.error) throw callsTodayRes.error
        if (callsThisWeekRes.error) throw callsThisWeekRes.error
        if (pendingFollowupsRes.error) throw pendingFollowupsRes.error
        if (unmappedCountRes.error) throw unmappedCountRes.error
        if (prayersCountRes.error) throw prayersCountRes.error
        if (profilesRes.error) throw profilesRes.error
        if (allContactsRes.error) throw allContactsRes.error
        if (trendCallsRes.error) throw trendCallsRes.error
        if (latestCallsRes.error) throw latestCallsRes.error
        if (latestFollowupsRes.error) throw latestFollowupsRes.error

        // Set KPIs
        setTotalContacts(contactsCountRes.count || 0)
        setCallsToday(callsTodayRes.count || 0)
        setCallsThisWeek(callsThisWeekRes.count || 0)
        setNeedingFollowup(pendingFollowupsRes.count || 0)
        setUnmappedLocations(unmappedCountRes.count || 0)
        setPrayerRequests(prayersCountRes.count || 0)

        const profiles = profilesRes.data || []
        const contacts = allContactsRes.data || []
        const trendCalls = trendCallsRes.data || []

        // --- 1. Calls Trend Chart Data (30 Days) ---
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
          } catch (e) {
            console.error('Error parsing trend call date:', e)
          }
        })
        const formattedTrend = Object.keys(trendMap).map((key) => {
          const date = new Date(key)
          const name = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return { name, count: trendMap[key] }
        })
        setCallsTrend(formattedTrend)

        // --- 2. Contacts by State Chart Data (Top 10) ---
        const stateCounts: Record<string, number> = {}
        contacts.forEach((c) => {
          const state = c.state ? c.state.trim() : 'Unspecified'
          stateCounts[state] = (stateCounts[state] || 0) + 1
        })
        const formattedStates = Object.keys(stateCounts)
          .map((state) => ({ name: state, count: stateCounts[state] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
        setStateChartData(formattedStates)

        // Filter for active agents in stats
        const agents = profiles.filter((p) => p.role === 'agent' || p.role === 'admin')

        // Fetch counts for agent stats table
        // First map profile IDs for fast access
        const agentStatsMap = new Map<string, AgentStat>()
        agents.forEach((agent) => {
          agentStatsMap.set(agent.id, {
            id: agent.id,
            name: agent.full_name || 'Unnamed Agent',
            role: agent.role,
            contactsAssigned: 0,
            callsToday: 0,
            callsThisWeek: 0,
            pendingFollowups: 0,
          })
        })

        // Accumulate contacts assigned
        contacts.forEach((c) => {
          if (c.assigned_agent_id && agentStatsMap.has(c.assigned_agent_id)) {
            agentStatsMap.get(c.assigned_agent_id)!.contactsAssigned++
          }
        })

        // Accumulate calls (today & this week)
        const todayStartVal = startOfToday.getTime()
        const weekStartVal = startOfWeek.getTime()

        trendCalls.forEach((call) => {
          if (call.agent_id && agentStatsMap.has(call.agent_id)) {
            const agentStat = agentStatsMap.get(call.agent_id)!
            try {
              const callTime = new Date(call.started_at).getTime()
              if (callTime >= todayStartVal) {
                agentStat.callsToday++
              }
              if (callTime >= weekStartVal) {
                agentStat.callsThisWeek++
              }
            } catch (e) {
              console.error('Call time parse error:', e)
            }
          }
        })

        // Fetch pending follow-ups counts per agent
        const { data: followupsList, error: followupsErr } = await supabase
          .from('followups')
          .select('agent_id')
          .eq('status', 'pending')
        if (followupsErr) throw followupsErr

        if (followupsList) {
          followupsList.forEach((f) => {
            if (f.agent_id && agentStatsMap.has(f.agent_id)) {
              agentStatsMap.get(f.agent_id)!.pendingFollowups++
            }
          })
        }

        setAgentsStats(Array.from(agentStatsMap.values()))

        // --- 3. Pipeline per Agent Chart Data (Stacked) ---
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
          // Only show agents who actually have assigned contacts to keep chart clean
          const total = item.New + item.Attempted + item.Connected + item['Follow-up Required'] + item['Not Interested']
          return total > 0
        })
        setPipelineChartData(pipelineData)

        // --- 4. Org Activity Feed ---
        const feedItems: ActivityItem[] = []

        if (latestCallsRes.data) {
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

  const handleSort = (field: keyof AgentStat) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const sortedAgents = [...agentsStats].sort((a, b) => {
    const valA = a[sortBy]
    const valB = b[sortBy]
    if (typeof valA === 'string') {
      return sortOrder === 'asc'
        ? valA.localeCompare(valB as string)
        : (valB as string).localeCompare(valA)
    }
    return sortOrder === 'asc'
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number)
  })

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

  const kpis = [
    { title: 'Total Contacts', value: totalContacts, icon: Users, color: 'text-[var(--info)]' },
    { title: 'Calls Today', value: callsToday, icon: Phone, color: 'text-[var(--gold-400)]' },
    { title: 'Calls This Week', value: callsThisWeek, icon: TrendingUp, color: 'text-[var(--success)]' },
    { title: 'Pending Follow-ups', value: needingFollowup, icon: Clock, color: 'text-[var(--warning)]' },
    { title: 'Unmapped Locations', value: unmappedLocations, icon: MapPin, color: 'text-[var(--danger)]' },
    { title: 'Prayer Requests', value: prayerRequests, icon: Heart, color: 'text-pink-400' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Admin Dashboard"
        description="Monitor organization-wide metrics, agent performance, and follow-up pipeline."
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => (
          <Card
            key={idx}
            className="bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--gold-500)]/20 transition-all duration-300 shadow-sm"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-secondary)] truncate">
                  {kpi.title}
                </span>
                <kpi.icon className={`h-4 w-4 shrink-0 ${kpi.color}`} />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-white tracking-tight">{kpi.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Leaderboard / Performance Table */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">Agent Performance</CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Summary of agent call statistics and assignment load. Click headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/30">
                <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Agent Name
                </th>
                <th
                  onClick={() => handleSort('contactsAssigned')}
                  className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Contacts Assigned <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('callsToday')}
                  className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Calls Today <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('callsThisWeek')}
                  className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Calls This Week <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pendingFollowups')}
                  className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Pending Follow-ups <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {sortedAgents.map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-[var(--bg-hover)]/40 transition-colors duration-200"
                >
                  <td className="p-4 font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--gold-400)]" />
                    {agent.name}
                  </td>
                  <td className="p-4 text-white font-medium">{agent.contactsAssigned}</td>
                  <td className="p-4 text-white font-medium">{agent.callsToday}</td>
                  <td className="p-4 text-white font-medium">{agent.callsThisWeek}</td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        agent.pendingFollowups > 0
                          ? 'bg-[var(--warning-muted)]/30 text-[var(--warning)] border border-[var(--warning)]/20'
                          : 'bg-[var(--border-default)] text-[var(--text-muted)]'
                      }`}
                    >
                      {agent.pendingFollowups} pending
                    </span>
                  </td>
                </tr>
              ))}
              {sortedAgents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-[var(--text-muted)]">
                    No active agents found in the registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Graphical Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 30 Days Calls Trend Line Chart */}
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Call Volume Trend</CardTitle>
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
                      borderRadius: '8px',
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

        {/* Contacts by State Horizontal Bar Chart */}
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Top 10 States</CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Geographic distribution of all registered contacts
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pr-4">
            {mounted && stateChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stateChartData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-default)',
                      borderRadius: '8px',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="count" fill="var(--info)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                No geographic state data found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stacked Agent Pipeline Chart & Feed Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pipeline per Agent Stacked Bar Chart */}
        <Card className="lg:col-span-2 bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Status Pipeline by Agent</CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Breakdown of contact status assignments for each agent
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pr-4">
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
                      borderRadius: '8px',
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

        {/* Global Recent Activity Feed */}
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Organization Activity</CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Latest events logged across the organization
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[320px] overflow-y-auto">
            {activities.length > 0 ? (
              <div className="divide-y divide-[var(--border-default)]">
                {activities.map((act) => (
                  <div key={act.id} className="p-4 hover:bg-[var(--bg-hover)]/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white line-clamp-2">{act.title}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{act.subtitle}</p>
                        {act.notes && (
                          <p className="text-[11px] text-[var(--text-muted)] italic max-w-sm line-clamp-1">
                            "{act.notes}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {mounted ? formatDistanceToNow(parseISO(act.timestamp), { addSuffix: false }) : ''}
                        </span>
                        {act.contactId && (
                          <Link
                            href={`/contacts/${act.contactId}`}
                            className="p-0.5 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
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
    </div>
  )
}
