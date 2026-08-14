'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { MessageSquare } from 'lucide-react'

interface WhatsAppRecord {
  template_used: string | null
  marked_sent_at: string | null
  created_at: string
  agent_id: string
}

interface WhatsAppAnalyticsProps {
  messages: WhatsAppRecord[]
  mounted: boolean
}

export default function WhatsAppAnalytics({ messages, mounted }: WhatsAppAnalyticsProps) {
  // 1. Messages by day
  const volumeData = useMemo(() => {
    if (!messages || messages.length === 0) return []

    const trendMap: Record<string, number> = {}
    messages.forEach((msg) => {
      try {
        const key = msg.created_at.split('T')[0]
        trendMap[key] = (trendMap[key] || 0) + 1
      } catch (e) {
        console.error('Invalid message created_at:', msg.created_at)
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
  }, [messages])

  // 2. Template usage distribution
  const templateData = useMemo(() => {
    if (!messages || messages.length === 0) return []

    const counts: Record<string, number> = {}
    messages.forEach((msg) => {
      const template = msg.template_used || 'Custom / Direct'
      counts[template] = (counts[template] || 0) + 1
    })

    return Object.keys(counts)
      .map((tpl) => ({
        name: tpl,
        count: counts[tpl],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [messages])

  if (!messages || messages.length === 0) {
    return (
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm p-6 text-center">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="p-3 rounded-full bg-[#25D366]/10 text-[#25D366]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">WhatsApp Outreach</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm">
            No WhatsApp outreach messages logged for this timeframe. Agents can log sends directly from contact profiles.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Outreach Volume by Day */}
      <Card className="lg:col-span-2 bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#25D366]" />
            <CardTitle className="text-base font-semibold text-white">
              WhatsApp Outreach Activity
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Daily volume of logged WhatsApp messages dispatched to contacts
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[260px] pr-4">
          {mounted && volumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  itemStyle={{ color: '#25D366' }}
                />
                <Bar
                  dataKey="count"
                  name="Messages Sent"
                  fill="#25D366"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              No message logs found for this timeframe.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Templates Used */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">
            Top Templates Used
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">
            Most frequent outreach templates selected
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[260px] pr-4">
          {mounted && templateData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={templateData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
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
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-default)',
                    borderRadius: '12px',
                  }}
                  itemStyle={{ color: '#25D366' }}
                />
                <Bar
                  dataKey="count"
                  name="Sends"
                  fill="#25D366"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              No template statistics available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
