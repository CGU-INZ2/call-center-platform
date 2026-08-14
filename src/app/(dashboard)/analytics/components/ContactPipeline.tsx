'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ContactRecord {
  call_status: string | null
  created_at: string
  source: string | null
}

interface ContactPipelineProps {
  contacts: ContactRecord[]
  mounted: boolean
}

const STATUS_COLORS: Record<string, string> = {
  New: '#3B82F6',
  Attempted: '#F59E0B',
  Connected: '#10B981',
  'Follow-up Required': '#8B5CF6',
  'Not Interested': '#EF4444',
}

const ORDERED_STATUSES = [
  'New',
  'Attempted',
  'Connected',
  'Follow-up Required',
  'Not Interested',
]

export default function ContactPipeline({ contacts, mounted }: ContactPipelineProps) {
  // 1. Funnel data by call_status
  const funnelData = useMemo(() => {
    if (!contacts || contacts.length === 0) return []

    const statusCounts: Record<string, number> = {
      New: 0,
      Attempted: 0,
      Connected: 0,
      'Follow-up Required': 0,
      'Not Interested': 0,
    }

    contacts.forEach((c) => {
      const st = c.call_status || 'New'
      if (statusCounts[st] !== undefined) {
        statusCounts[st]++
      } else {
        statusCounts[st] = (statusCounts[st] || 0) + 1
      }
    })

    return ORDERED_STATUSES.map((statusName) => ({
      name: statusName,
      count: statusCounts[statusName] || 0,
      fill: STATUS_COLORS[statusName] || '#6B7280',
    }))
  }, [contacts])

  // 2. Monthly contact acquisition trend
  const growthData = useMemo(() => {
    if (!contacts || contacts.length === 0) return []

    const monthMap: Record<string, number> = {}
    contacts.forEach((c) => {
      try {
        const d = new Date(c.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthMap[key] = (monthMap[key] || 0) + 1
      } catch (e) {
        console.error('Invalid contact date:', c.created_at)
      }
    })

    return Object.keys(monthMap)
      .sort()
      .map((key) => {
        const [year, month] = key.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1, 1)
        const name = date.toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        })
        return {
          name,
          monthKey: key,
          count: monthMap[key],
        }
      })
  }, [contacts])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Funnel Horizontal Bar */}
      <Card className="lg:col-span-2 bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">
            Lead Status Pipeline Funnel
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Distribution of registered contacts across outreach progression stages
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] pr-4">
          {mounted && funnelData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 15, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={130}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-default)',
                    borderRadius: '12px',
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="count" name="Contacts" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              No contact pipeline data available.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Growth (Area Chart) */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">
            Contact Acquisition Growth
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            New contact registrations over time
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] pr-4">
          {mounted && growthData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--info)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--info)" stopOpacity={0} />
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
                  itemStyle={{ color: 'var(--info)' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="New Contacts"
                  stroke="var(--info)"
                  strokeWidth={2}
                  fill="url(#blueAreaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              No acquisition growth history.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
