'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface CallRecord {
  started_at: string
  duration_secs: number | null
  outcome: string | null
  agent_id: string
}

interface CallAnalyticsProps {
  callsRaw: CallRecord[]
  mounted: boolean
}

const OUTCOME_COLORS: Record<string, string> = {
  answered: '#10B981', // green
  connected: '#10B981',
  no_answer: '#F59E0B', // yellow
  busy: '#EF4444', // red
  callback_requested: '#8B5CF6', // purple
  prayer_request: '#60A5FA', // blue
  not_interested: '#6B7280', // gray
  other: '#94A3B8',
}

export default function CallAnalytics({ callsRaw, mounted }: CallAnalyticsProps) {
  // 1. Call Volume by Day
  const volumeData = useMemo(() => {
    if (!callsRaw || callsRaw.length === 0) return []

    const trendMap: Record<string, number> = {}

    // Collect timestamps and group by YYYY-MM-DD
    callsRaw.forEach((call) => {
      try {
        const key = call.started_at.split('T')[0]
        trendMap[key] = (trendMap[key] || 0) + 1
      } catch (e) {
        console.error('Invalid call started_at:', call.started_at)
      }
    })

    return Object.keys(trendMap)
      .sort()
      .map((key) => {
        const date = new Date(key)
        const name = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        return {
          name,
          dateKey: key,
          count: trendMap[key],
        }
      })
  }, [callsRaw])

  // 2. Call Outcomes Distribution
  const outcomesData = useMemo(() => {
    if (!callsRaw || callsRaw.length === 0) return []

    const counts: Record<string, number> = {}
    callsRaw.forEach((call) => {
      const outcome = call.outcome ? call.outcome.toLowerCase() : 'other'
      counts[outcome] = (counts[outcome] || 0) + 1
    })

    return Object.keys(counts).map((outcomeKey) => {
      const label = outcomeKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      return {
        name: label,
        key: outcomeKey,
        value: counts[outcomeKey],
        color: OUTCOME_COLORS[outcomeKey] || '#94A3B8',
      }
    })
  }, [callsRaw])

  // 3. Peak Calling Hours (0-23)
  const { hourCounts, maxHourCount } = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let i = 0; i < 24; i++) counts[i] = 0

    let max = 0
    callsRaw.forEach((call) => {
      try {
        const hour = new Date(call.started_at).getHours()
        counts[hour] = (counts[hour] || 0) + 1
        if (counts[hour] > max) max = counts[hour]
      } catch (e) {
        console.error('Error parsing call hour:', e)
      }
    })

    return { hourCounts: counts, maxHourCount: max }
  }, [callsRaw])

  return (
    <div className="space-y-6">
      {/* 2-Column Row: Volume Trend & Outcome Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Volume Over Time (Area Chart) */}
        <Card className="lg:col-span-2 bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-white">
              Call Volume Trend
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Daily volume of calls logged during the selected timeframe
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pr-4">
            {mounted && volumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--gold-400)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--gold-400)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Calls"
                    stroke="var(--gold-400)"
                    strokeWidth={2}
                    fill="url(#goldAreaGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                No call volume recorded for this timeframe.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Outcomes Donut */}
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Call Outcomes
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              Breakdown of call connection results
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] flex flex-col justify-between pb-6">
            {mounted && outcomesData.length > 0 ? (
              <>
                <div className="h-[170px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={outcomesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {outcomesData.map((entry, index) => (
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
                </div>
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs px-2 pt-2 border-t border-[var(--border-subtle)]">
                  {outcomesData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[var(--text-secondary)] truncate">
                        {item.name}: <span className="font-mono text-white font-medium">{item.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                No call outcome data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full-width Heatmap Card: Peak Calling Hours */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">
            Peak Calling Hours
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Distribution of call activity across the 24-hour day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-6 sm:grid-cols-12 lg:grid-cols-24 gap-1.5">
            {Array.from({ length: 24 }, (_, hour) => {
              const count = hourCounts[hour] || 0
              const intensity = maxHourCount > 0 ? count / maxHourCount : 0
              const hourFormatted = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`

              return (
                <div
                  key={hour}
                  className="rounded-lg p-2 flex flex-col items-center justify-center text-center transition-all duration-150 group border border-transparent hover:border-[var(--gold-400)]/40"
                  style={{
                    backgroundColor:
                      intensity > 0
                        ? `rgba(212, 168, 83, ${Math.max(0.12, intensity * 0.85)})`
                        : 'var(--bg-elevated)',
                  }}
                  title={`${hourFormatted}: ${count} call(s)`}
                >
                  <span className="font-mono text-[10px] text-[var(--text-secondary)] group-hover:text-white">
                    {hour.toString().padStart(2, '0')}h
                  </span>
                  <span className="font-mono font-bold text-xs text-white mt-0.5">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1 pt-1 font-mono">
            <span>12 AM (Midnight)</span>
            <span>06 AM</span>
            <span>12 PM (Noon)</span>
            <span>06 PM</span>
            <span>11 PM</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
