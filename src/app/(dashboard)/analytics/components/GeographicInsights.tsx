'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MapPin, Globe, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface ContactRecord {
  state: string | null
  geo_status: string | null
}

interface GeographicInsightsProps {
  contacts: ContactRecord[]
}

export default function GeographicInsights({ contacts }: GeographicInsightsProps) {
  // Aggregate state counts
  const { stateList, unmappedCount, mappedCount } = useMemo(() => {
    if (!contacts || contacts.length === 0) {
      return { stateList: [], unmappedCount: 0, mappedCount: 0 }
    }

    const stateMap: Record<string, number> = {}
    let unmapped = 0
    let mapped = 0

    contacts.forEach((c) => {
      if (c.geo_status === 'unmapped' || !c.state || c.state.trim() === '') {
        unmapped++
      } else {
        mapped++
        const stateName = c.state.trim()
        stateMap[stateName] = (stateMap[stateName] || 0) + 1
      }
    })

    const list = Object.keys(stateMap)
      .map((name) => ({ name, count: stateMap[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    return { stateList: list, unmappedCount: unmapped, mappedCount: mapped }
  }, [contacts])

  const maxCount = stateList.length > 0 ? Math.max(...stateList.map((s) => s.count)) : 1

  return (
    <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] rounded-[16px] shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--gold-400)]" />
              <CardTitle className="text-base font-semibold text-white">
                Geographic Coverage & Regional Load
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[var(--text-secondary)]">
              State-level distribution of registered ministry contacts across India
            </CardDescription>
          </div>

          {/* Mapped vs Unmapped counter badge */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)]">
              Mapped: <strong className="text-white font-mono">{mappedCount}</strong>
            </span>
            {unmappedCount > 0 && (
              <Link
                href="/contacts"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--warning-muted)]/20 border border-[var(--warning)]/20 text-[11px] font-medium text-[var(--warning)] hover:bg-[var(--warning-muted)]/30 transition-colors"
                title="View contacts missing state / city"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{unmappedCount} Unmapped</span>
              </Link>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {stateList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stateList.map((st, idx) => {
              const pct = Math.round((st.count / maxCount) * 100)
              return (
                <div
                  key={idx}
                  className="bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)] truncate">
                      <MapPin className="w-3.5 h-3.5 text-[var(--gold-400)] shrink-0" />
                      <span className="truncate">{st.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-white ml-2">
                      {st.count}
                    </span>
                  </div>
                  {/* Visual progress track */}
                  <div className="h-1.5 w-full bg-[#181a22] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--gold-400)] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            No geographic regional records found. Import contacts or assign state locations to populate.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
