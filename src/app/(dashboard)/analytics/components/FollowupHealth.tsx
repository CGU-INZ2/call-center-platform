'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface FollowupRecord {
  due_at: string
  status: string
  created_at: string
  updated_at: string
}

interface FollowupHealthProps {
  followups: FollowupRecord[]
  mounted: boolean
}

export default function FollowupHealth({ followups, mounted }: FollowupHealthProps) {
  // 1. Completion rate distribution
  const { statusData, completionRate } = useMemo(() => {
    if (!followups || followups.length === 0) {
      return { statusData: [], completionRate: 0 }
    }

    const counts: Record<string, number> = {
      done: 0,
      pending: 0,
      missed: 0,
    }

    followups.forEach((f) => {
      const st = f.status || 'pending'
      if (counts[st] !== undefined) counts[st]++
      else counts[st] = 1
    })

    const total = followups.length
    const done = counts.done || 0
    const rate = total > 0 ? (done / total) * 100 : 0

    const data = [
      { name: 'Done', value: counts.done, color: '#10B981' },
      { name: 'Pending', value: counts.pending, color: '#F59E0B' },
      { name: 'Missed', value: counts.missed, color: '#EF4444' },
    ].filter((item) => item.value > 0)

    return { statusData: data, completionRate: rate }
  }, [followups])

  // 2. Overdue aging breakdown
  const agingData = useMemo(() => {
    if (!followups || followups.length === 0) return []

    const now = Date.now()
    const overdueList = followups.filter(
      (f) => f.status === 'pending' && new Date(f.due_at).getTime() < now
    )

    const buckets = {
      '1-3 Days': 0,
      '4-7 Days': 0,
      '1-2 Weeks': 0,
      '2+ Weeks': 0,
    }

    overdueList.forEach((f) => {
      const dueTime = new Date(f.due_at).getTime()
      const daysOverdue = Math.max(0, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)))

      if (daysOverdue <= 3) buckets['1-3 Days']++
      else if (daysOverdue <= 7) buckets['4-7 Days']++
      else if (daysOverdue <= 14) buckets['1-2 Weeks']++
      else buckets['2+ Weeks']++
    })

    return [
      { name: '1-3 Days', count: buckets['1-3 Days'], fill: '#FBBF24' },
      { name: '4-7 Days', count: buckets['4-7 Days'], fill: '#F97316' },
      { name: '1-2 Weeks', count: buckets['1-2 Weeks'], fill: '#EF4444' },
      { name: '2+ Weeks', count: buckets['2+ Weeks'], fill: '#DC2626' },
    ]
  }, [followups])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Follow-up Completion Donut */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white">
            Follow-up Completion
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Resolution rate of scheduled commitments
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] flex flex-col justify-between pb-6">
          {mounted && statusData.length > 0 ? (
            <>
              <div className="relative h-[170px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-default)',
                        borderRadius: '12px',
                      }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center metric */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-mono font-bold text-white">
                    {completionRate.toFixed(0)}%
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                    Resolved
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-2 text-xs px-2 pt-2 border-t border-[var(--border-subtle)]">
                {statusData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 justify-center">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[var(--text-secondary)]">
                      {item.name}: <span className="font-mono text-white font-medium">{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              No follow-up records found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue Aging Histogram */}
      <Card className="lg:col-span-2 bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">
            Overdue Follow-up Aging
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Breakdown of pending commitments past their target due date
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] pr-4">
          {mounted && agingData.some((b) => b.count > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="count" name="Overdue Tasks" radius={[4, 4, 0, 0]} maxBarSize={55}>
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col h-full items-center justify-center text-sm text-[var(--text-muted)] gap-1">
              <span className="text-[var(--success)] font-medium">All caught up!</span>
              <span>No overdue follow-up tasks currently pending.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
