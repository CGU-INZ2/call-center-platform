'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ArrowUpDown, Users } from 'lucide-react'

interface AgentProfile {
  id: string
  full_name: string
}

interface CallRecord {
  agent_id: string
  started_at: string
  duration_secs: number | null
  outcome: string | null
}

interface ContactRecord {
  assigned_agent_id: string | null
  call_status: string | null
}

interface FollowupRecord {
  agent_id: string
  status: string
}

interface AgentPerformanceProps {
  agents: AgentProfile[]
  callsRaw: CallRecord[]
  contacts: ContactRecord[]
  followups: FollowupRecord[]
  mounted: boolean
}

type SortKey = 'name' | 'contactsAssigned' | 'callsMade' | 'avgSeconds' | 'conversionRate' | 'followupsDone'

function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export default function AgentPerformance({
  agents,
  callsRaw,
  contacts,
  followups,
  mounted,
}: AgentPerformanceProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'callsMade',
    dir: 'desc',
  })

  // Compute stats per agent
  const agentStats = useMemo(() => {
    if (!agents || agents.length === 0) return []

    return agents.map((agent) => {
      const agentCalls = callsRaw.filter((c) => c.agent_id === agent.id)
      const agentContacts = contacts.filter((c) => c.assigned_agent_id === agent.id)
      const agentFollowups = followups.filter((f) => f.agent_id === agent.id)

      // Average talk time only over connected calls (duration_secs > 0)
      const connectedCalls = agentCalls.filter(
        (c) => c.duration_secs !== null && c.duration_secs > 0
      )
      const totalConnectedDuration = connectedCalls.reduce(
        (sum, c) => sum + (c.duration_secs || 0),
        0
      )
      const avgSeconds =
        connectedCalls.length > 0
          ? Math.round(totalConnectedDuration / connectedCalls.length)
          : 0

      // Conversion: connected contacts / assigned contacts
      const connectedContacts = agentContacts.filter(
        (c) => c.call_status === 'Connected'
      ).length
      const conversionRate =
        agentContacts.length > 0
          ? (connectedContacts / agentContacts.length) * 100
          : 0

      const followupsDone = agentFollowups.filter((f) => f.status === 'done').length

      return {
        id: agent.id,
        name: agent.full_name || 'Unnamed Agent',
        contactsAssigned: agentContacts.length,
        callsMade: agentCalls.length,
        avgSeconds,
        avgDurationFormatted: formatSeconds(avgSeconds),
        conversionRate,
        followupsDone,
      }
    })
  }, [agents, callsRaw, contacts, followups])

  // Sorting
  const sortedAgents = useMemo(() => {
    const list = [...agentStats]
    list.sort((a, b) => {
      let aVal = a[sortConfig.key]
      let bVal = b[sortConfig.key]

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }

      if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [agentStats, sortConfig])

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }))
  }

  // Chart data
  const chartData = useMemo(() => {
    return agentStats.map((a) => ({
      name: a.name.split(' ')[0], // first name for clean axis
      calls: a.callsMade,
    }))
  }, [agentStats])

  return (
    <div className="space-y-6">
      {/* Agent Leaderboard Table Card */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-white">
                Agent Performance Leaderboard
              </CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)]">
                Comparative metrics across all active team members
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] text-[var(--gold-400)] text-xs font-semibold">
              <Users className="w-3.5 h-3.5" />
              <span>{agents.length} Agents</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[#171920]">
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Agent</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('contactsAssigned')}
                  className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Contacts</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('callsMade')}
                  className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Calls (Period)</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('avgSeconds')}
                  className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Avg Talk Time</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('conversionRate')}
                  className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Conversion</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('followupsDone')}
                  className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Follow-ups Done</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {sortedAgents.map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <td className="px-6 py-3.5 font-medium text-white">
                    {agent.name}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-[var(--text-secondary)] text-right">
                    {agent.contactsAssigned}
                  </td>
                  <td className="px-6 py-3.5 font-mono font-medium text-white text-right">
                    {agent.callsMade}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-[var(--gold-400)] text-right">
                    {agent.avgDurationFormatted}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-[var(--success)] text-right">
                    {agent.conversionRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-3.5 font-mono text-[var(--text-primary)] text-right">
                    {agent.followupsDone}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Calls by Agent Bar Chart */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">
            Call Distribution by Agent
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Total logged calls completed per agent during this timeframe
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] pr-4">
          {mounted && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  itemStyle={{ color: 'var(--gold-400)' }}
                />
                <Bar
                  dataKey="calls"
                  name="Calls"
                  fill="var(--gold-400)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              No agent call activity to display.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
