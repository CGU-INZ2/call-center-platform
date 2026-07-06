'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Heart, Search, Filter, Printer, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface PrayerRequest {
  id: string
  created_at: string
  type: 'prayer' | 'testimony'
  content: string
  agent: { full_name: string } | null
  contact: { id: string; full_name: string } | null
}

interface PrayersClientProps {
  prayers: PrayerRequest[]
  isAdmin: boolean
}

export default function PrayersClient({ prayers, isAdmin }: PrayersClientProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'prayer' | 'testimony'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return prayers.filter(p => {
      const matchesType = filter === 'all' || p.type === filter
      const q = search.toLowerCase()
      const matchesSearch = !q ||
        p.contact?.full_name?.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.agent?.full_name?.toLowerCase().includes(q)
      return matchesType && matchesSearch
    })
  }, [prayers, filter, search])

  const handlePrint = () => window.print()

  const typeBadge = (type: 'prayer' | 'testimony') =>
    type === 'prayer' ? (
      <Badge className="bg-pink-500/15 text-pink-300 border-pink-500/30 border text-xs font-semibold">
        🙏 Prayer
      </Badge>
    ) : (
      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 border text-xs font-semibold">
        ✨ Testimony
      </Badge>
    )

  return (
    <>
      {/* ── Printable view (hidden on screen, shown on print) ── */}
      <div className="hidden print:block p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black">Ministry Prayer Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Printed {format(new Date(), 'PPP')}</p>
        </div>
        {filtered.map((p, i) => (
          <div key={p.id} className="mb-6 pb-6 border-b border-gray-200 last:border-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-black text-lg">{p.contact?.full_name}</span>
              <span className="text-xs text-gray-500 uppercase font-semibold">{p.type}</span>
            </div>
            <p className="text-gray-700 leading-relaxed">{p.content}</p>
            <p className="text-xs text-gray-400 mt-2">
              {format(parseISO(p.created_at), 'PPP')} — {p.agent?.full_name}
            </p>
          </div>
        ))}
      </div>

      {/* ── Screen view ── */}
      <div className="space-y-6 print:hidden">
        <PageHeader
          title="Prayer Requests"
          description={`${prayers.length} total request${prayers.length !== 1 ? 's' : ''} · ${isAdmin ? 'All agents' : 'Your contacts'}`}
          action={
            <Button
              variant="outline"
              onClick={handlePrint}
              className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white gap-2"
            >
              <Printer className="h-4 w-4" />
              Print List
            </Button>
          }
        />

        {/* Filter bar */}
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts, content, agents…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-500)]/50"
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg p-1">
              {(['all', 'prayer', 'testimony'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize ${
                    filter === opt
                      ? 'bg-[var(--gold-500)]/20 text-[var(--gold-400)] border border-[var(--gold-500)]/30'
                      : 'text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  {opt === 'all' ? 'All' : opt === 'prayer' ? '🙏 Prayers' : '✨ Testimonies'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {filtered.length === 0 ? (
          <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
            <CardContent className="p-12 text-center">
              <Heart className="mx-auto h-8 w-8 text-[var(--text-muted)] mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">No prayer requests found.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)] text-xs uppercase">Contact</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs uppercase">Type</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs uppercase w-[40%]">Content</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs uppercase">Date</TableHead>
                  {isAdmin && <TableHead className="text-[var(--text-muted)] text-xs uppercase">Agent</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow
                    key={p.id}
                    className="border-[var(--border-default)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onClick={() => p.contact && router.push(`/contacts/${p.contact.id}`)}
                  >
                    <TableCell className="font-semibold text-white">
                      <div className="flex items-center gap-1.5">
                        {p.contact?.full_name ?? '—'}
                        <ExternalLink className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                      </div>
                    </TableCell>
                    <TableCell>{typeBadge(p.type)}</TableCell>
                    <TableCell className="text-[var(--text-secondary)] text-sm">
                      <p className="line-clamp-2">{p.content}</p>
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)] text-xs whitespace-nowrap">
                      {format(parseISO(p.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-[var(--text-secondary)] text-xs">
                        {p.agent?.full_name ?? '—'}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  )
}
