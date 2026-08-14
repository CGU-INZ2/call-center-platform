'use client'

import React from 'react'
import { Download } from 'lucide-react'

interface DateRangeFilterProps {
  activePreset: string // '7d' | '30d' | '90d' | 'all'
  onPresetChange: (preset: string) => void
  onExportCsv: () => void
}

const PRESETS = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'all', label: 'All Time' },
]

export default function DateRangeFilter({
  activePreset,
  onPresetChange,
  onExportCsv,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Preset range buttons */}
      <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-default)]">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id
          return (
            <button
              key={preset.id}
              onClick={() => onPresetChange(preset.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--gold-400)] text-[#0f1117] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {/* Export CSV action */}
      <button
        onClick={onExportCsv}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--gold-400)]/40 shadow-sm"
        title="Export Analytics Summary as CSV"
      >
        <Download className="w-3.5 h-3.5 text-[var(--gold-400)]" />
        <span>Export CSV</span>
      </button>
    </div>
  )
}
