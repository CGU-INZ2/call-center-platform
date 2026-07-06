'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import CallLogModal from '@/components/shared/CallLogModal'
import {
  Search,
  Plus,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Phone,
  PhoneCall,
  Mail,
  User,
  FolderOpen,
  Calendar,
  Check
} from 'lucide-react'

interface Category {
  id: number
  label: string
  color_hex: string
}

interface Agent {
  id: string
  full_name: string
}

interface Contact {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  call_status: string | null
  category_id: number | null
  assigned_agent_id: string | null
  created_at: string
  notes: string | null
  category?: Category
  agent?: Agent
}

interface ContactsClientProps {
  userRole: string
  initialCategories: Category[]
  initialAgents: Agent[]
}

export default function ContactsClient({
  userRole,
  initialCategories,
  initialAgents
}: ContactsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const createParam = searchParams.get('create')

  // List states
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>()

  // Filter states
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [assignedAgentId, setAssignedAgentId] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modal / Form states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newAgentId, setNewAgentId] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Bulk actions pending states
  const [updatingBulk, setUpdatingBulk] = useState(false)

  // Call logging from table row
  const [logCallContact, setLogCallContact] = useState<{
    id: string; name: string; status: string | null
  } | null>(null)

  // Initialize selectedIds safely
  useEffect(() => {
    setSelectedIds([])
  }, [])

  // Prefill create modal if phone number passed from TopBar
  useEffect(() => {
    if (createParam) {
      setNewPhone(decodeURIComponent(createParam))
      setIsCreateOpen(true)
    }
  }, [createParam])

  // Fetch contacts list
  const fetchContacts = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        category_id: categoryId,
        assigned_agent_id: assignedAgentId,
        sortBy,
        sortOrder
      })

      const res = await fetch(`/api/contacts?${queryParams.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch contacts')
      }

      setContacts(data.contacts || [])
      setTotalCount(data.count || 0)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Could not load contacts')
    } finally {
      setLoading(false)
    }
  }

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchContacts()
    setSelectedIds([]) // Reset selection on table parameter changes
  }, [page, limit, categoryId, assignedAgentId, sortBy, sortOrder])

  // Simple debounce helper for search string changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchContacts()
      setSelectedIds([])
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  // Select all / Toggle handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(contacts.map(c => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleRow = (id: string, checked: boolean) => {
    const current = selectedIds || []
    if (checked) {
      setSelectedIds([...current, id])
    } else {
      setSelectedIds(current.filter(item => item !== id))
    }
  }

  // Single or Bulk update categories or agent assignments
  const handleBulkUpdate = async (field: 'category_id' | 'assigned_agent_id', value: any) => {
    const idsToUpdate = selectedIds || []
    if (idsToUpdate.length === 0) return
    if (value === '') return

    try {
      setUpdatingBulk(true)
      const patchData: any = {}
      if (field === 'category_id') {
        patchData.category_id = value ? parseInt(value, 10) : null
      } else if (field === 'assigned_agent_id') {
        patchData.assigned_agent_id = value === 'unassigned' ? null : value
      }

      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToUpdate, patch: patchData })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update contacts')
      }

      toast.success(`Successfully updated ${data.updated_count} contact(s)`)
      setSelectedIds([])
      await fetchContacts()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error occurred during update')
    } finally {
      setUpdatingBulk(false)
    }
  }

  // CSV Export utility
  const handleCSVExport = async () => {
    try {
      toast.loading('Preparing CSV export...', { id: 'csv-export' })
      const queryParams = new URLSearchParams({
        search,
        category_id: categoryId,
        assigned_agent_id: assignedAgentId,
        sortBy,
        sortOrder,
        page: '1',
        limit: '10000' // Safe large limit for export
      })

      const res = await fetch(`/api/contacts?${queryParams.toString()}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to fetch contacts for export')
      
      const exportList = data.contacts || []
      if (exportList.length === 0) {
        toast.dismiss('csv-export')
        toast.error('No matching contacts found to export')
        return
      }

      const headers = ['Full Name', 'Phone', 'Email', 'Category', 'Assigned Agent', 'Notes', 'Created At']
      const csvLines = [
        headers.join(','),
        ...exportList.map((c: Contact) => {
          const row = [
            c.full_name,
            c.phone || '',
            c.email || '',
            c.category?.label || '',
            c.agent?.full_name || 'Unassigned',
            c.notes || '',
            c.created_at ? new Date(c.created_at).toLocaleString() : ''
          ]
          return row.map(val => `"${val.replace(/"/g, '""')}"`).join(',')
        })
      ]

      const csvString = csvLines.join('\n')
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${exportList.length} contacts!`, { id: 'csv-export' })
    } catch (err: any) {
      console.error(err)
      toast.dismiss('csv-export')
      toast.error(err.message || 'Failed to export CSV')
    }
  }

  // Create Contact Handler
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFullName.trim()) {
      toast.error('Full name is required')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newFullName,
          phone: newPhone || null,
          email: newEmail || null,
          category_id: newCategoryId || null,
          assigned_agent_id: userRole === 'admin' ? (newAgentId || null) : undefined,
          notes: newNotes || null
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create contact')
      }

      toast.success('Contact created successfully!')
      handleCloseModal()
      await fetchContacts()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error occurred while creating contact')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseModal = () => {
    setIsCreateOpen(false)
    setNewFullName('')
    setNewPhone('')
    setNewEmail('')
    setNewCategoryId('')
    setNewAgentId('')
    setNewNotes('')
    if (createParam) {
      router.replace('/contacts')
    }
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Contacts Directory"
        description="Filter, sort, search, and bulk assign clients to lead categories and agents."
        action={
          <div className="flex items-center gap-3">
            {userRole === 'admin' && (
              <Link href="/settings/import">
                <Button
                  variant="outline"
                  className="border-[var(--gold-500)]/50 text-[var(--gold-300)] hover:bg-[var(--gold-500)]/10 hover:text-[var(--gold-200)] hover:border-[var(--gold-400)] font-semibold shadow-sm transition-all duration-200"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
              </Link>
            )}
            <Link href="/contacts/new">
              <Button
                className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter and Control Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--bg-surface)] border-[var(--border-default)] text-white placeholder-[var(--text-muted)] focus-visible:ring-[var(--gold-400)]"
          />
        </div>

        {/* Category Dropdown */}
        <div className="md:col-span-3">
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setPage(1)
            }}
            className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--gold-500)] cursor-pointer"
          >
            <option value="">All Categories</option>
            {initialCategories.map((c) => (
              <option key={c.id} value={c.id.toString()}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Agent Dropdown (Admin Only) */}
        {userRole === 'admin' && (
          <div className="md:col-span-3">
            <select
              value={assignedAgentId}
              onChange={(e) => {
                setAssignedAgentId(e.target.value)
                setPage(1)
              }}
              className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--gold-500)] cursor-pointer"
            >
              <option value="">All Agents</option>
              <option value="unassigned">Unassigned Contacts</option>
              {initialAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Button: CSV Export */}
        <div className="md:col-span-2 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCSVExport}
            className="w-full bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {(search || categoryId || assignedAgentId) && (
            <Button
              variant="ghost"
              size="icon"
              title="Clear all filters"
              onClick={() => {
                setSearch('')
                setCategoryId('')
                setAssignedAgentId('')
                setPage(1)
              }}
              className="text-[var(--text-secondary)] hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Table View */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-md)] overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <Table>
            <TableHeader className="bg-[#1f222b] border-b border-[var(--border-default)]">
              <TableRow className="hover:bg-transparent border-[var(--border-default)]">
                <TableHead className="w-12 py-3 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={contacts.length > 0 && selectedIds?.length === contacts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 accent-[var(--gold-400)] rounded cursor-pointer"
                  />
                </TableHead>
                <TableHead
                  onClick={() => handleSort('full_name')}
                  className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase cursor-pointer hover:text-white select-none transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Contact Name
                    {sortBy === 'full_name' && (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--gold-400)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--gold-400)]" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase">
                  Contact Details
                </TableHead>
                <TableHead
                  onClick={() => handleSort('category_id')}
                  className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase cursor-pointer hover:text-white select-none transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Lead Status / Category
                    {sortBy === 'category_id' && (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--gold-400)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--gold-400)]" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort('assigned_agent_id')}
                  className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase cursor-pointer hover:text-white select-none transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Assigned Agent
                    {sortBy === 'assigned_agent_id' && (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--gold-400)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--gold-400)]" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort('created_at')}
                  className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase cursor-pointer hover:text-white select-none transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Created At
                    {sortBy === 'created_at' && (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--gold-400)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--gold-400)]" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase w-16">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx} className="border-[var(--border-default)] hover:bg-transparent animate-pulse">
                    <TableCell className="py-4 px-4"><div className="w-4 h-4 bg-[var(--bg-elevated)] rounded" /></TableCell>
                    <TableCell className="py-4 px-4"><div className="w-32 h-4 bg-[var(--bg-elevated)] rounded" /></TableCell>
                    <TableCell className="py-4 px-4"><div className="w-40 h-4 bg-[var(--bg-elevated)] rounded" /></TableCell>
                    <TableCell className="py-4 px-4"><div className="w-24 h-5 bg-[var(--bg-elevated)] rounded-full" /></TableCell>
                    <TableCell className="py-4 px-4"><div className="w-28 h-4 bg-[var(--bg-elevated)] rounded" /></TableCell>
                    <TableCell className="py-4 px-4"><div className="w-24 h-4 bg-[var(--bg-elevated)] rounded" /></TableCell>
                  </TableRow>
                ))
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-[var(--text-secondary)]">
                    No contacts found. Try adjusting your filter parameters or create a new contact.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => {
                  const isChecked = selectedIds?.includes(contact.id) || false
                  const initials = contact.full_name
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                  return (
                    <TableRow
                      key={contact.id}
                      className={`border-b border-[var(--border-default)] transition-colors hover:bg-[var(--bg-hover)] cursor-pointer ${
                        isChecked ? 'bg-[var(--gold-500)]/5 hover:bg-[var(--gold-500)]/10' : ''
                      }`}
                      onClick={() => handleToggleRow(contact.id, !isChecked)}
                    >
                      {/* Checkbox cell */}
                      <TableCell className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleToggleRow(contact.id, e.target.checked)}
                          className="w-4 h-4 accent-[var(--gold-400)] rounded cursor-pointer"
                        />
                      </TableCell>

                      {/* Contact Name cell — clicking name navigates to detail page */}
                      <TableCell className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 group/name">
                          <div className="w-8 h-8 rounded-full bg-[var(--gold-500)]/10 border border-[var(--gold-500)]/20 text-[var(--gold-400)] flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <span className="text-sm font-semibold text-white group-hover/name:text-[var(--gold-300)] transition-colors underline-offset-2 group-hover/name:underline">{contact.full_name}</span>
                        </Link>
                      </TableCell>

                      {/* Contact Details cell */}
                      <TableCell className="py-3 px-4">
                        <div className="flex flex-col gap-0.5 text-xs text-[var(--text-secondary)]">
                          {contact.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              {contact.email}
                            </span>
                          )}
                          {!contact.phone && !contact.email && (
                            <span className="text-[var(--text-muted)] italic">No phone or email</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Category Badge cell */}
                      <TableCell className="py-3 px-4">
                        {contact.category ? (
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              backgroundColor: `${contact.category.color_hex}15`,
                              color: contact.category.color_hex,
                              borderColor: `${contact.category.color_hex}35`
                            }}
                          >
                            {contact.category.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">Uncategorized</span>
                        )}
                      </TableCell>

                      {/* Agent cell */}
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-2 text-sm">
                          {contact.agent ? (
                            <>
                              <User className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                              <span className="text-[var(--text-primary)] font-medium">
                                {contact.agent.full_name}
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--text-muted)] italic">Unassigned</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Created At cell */}
                      <TableCell className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          {new Date(contact.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </TableCell>

                      {/* Actions cell — Log Call */}
                      <TableCell className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setLogCallContact({
                            id: contact.id,
                            name: contact.full_name,
                            status: contact.call_status
                          })}
                          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--gold-400)] transition-colors"
                          title="Log Call"
                        >
                          <PhoneCall className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer with Pagination */}
        {!loading && contacts.length > 0 && (
          <div className="border-t border-[var(--border-default)] px-6 py-4 flex items-center justify-between bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)]">
            <div>
              Showing <span className="font-semibold text-white">{Math.min(totalCount, (page - 1) * limit + 1)}</span> to{' '}
              <span className="font-semibold text-white">{Math.min(totalCount, page * limit)}</span> of{' '}
              <span className="font-semibold text-white">{totalCount}</span> contacts
            </div>
            
            <div className="flex items-center gap-6">
              {/* Row Limit Select */}
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10))
                    setPage(1)
                  }}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-white outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Page navigation buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-white hover:bg-[var(--bg-hover)] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-1 text-white">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-white hover:bg-[var(--bg-hover)] disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Floating Premium Bulk Actions Bar */}
      {selectedIds && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--bg-surface)]/90 border border-[var(--gold-500)]/30 rounded-xl shadow-[var(--shadow-lg)] px-6 py-3.5 flex items-center gap-5 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[var(--gold-500)]/20 text-[var(--gold-400)] flex items-center justify-center font-bold text-xs shrink-0">
              {selectedIds.length}
            </div>
            <span className="text-sm font-medium text-white">
              contact{selectedIds.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="h-5 w-[1px] bg-[var(--border-default)]" />

          {/* Bulk Category Reassignment */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">Category:</span>
            <select
              defaultValue=""
              onChange={(e) => {
                handleBulkUpdate('category_id', e.target.value)
                e.target.value = '' // Reset selection
              }}
              disabled={updatingBulk}
              className="h-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-xs text-white outline-none focus:border-[var(--gold-500)] cursor-pointer"
            >
              <option value="" disabled>Update Lead Status...</option>
              {initialCategories.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Agent Assignment (Admin Only) */}
          {userRole === 'admin' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">Agent:</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  handleBulkUpdate('assigned_agent_id', e.target.value)
                  e.target.value = '' // Reset selection
                }}
                disabled={updatingBulk}
                className="h-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-xs text-white outline-none focus:border-[var(--gold-500)] cursor-pointer"
              >
                <option value="" disabled>Assign Agent...</option>
                <option value="unassigned">Unassign</option>
                {initialAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {updatingBulk && (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--gold-400)]" />
          )}

          <div className="h-5 w-[1px] bg-[var(--border-default)]" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds([])}
            className="text-[var(--text-secondary)] hover:text-white text-xs h-8 px-2"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Custom Premium Create Contact Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-lg)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
            
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] bg-[#1f222b]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 items-center justify-center flex rounded-full bg-[var(--gold-500)]/10 text-[var(--gold-400)] border border-[var(--gold-500)]/20 shadow-[0_0_10px_rgba(212,168,83,0.05)]">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Add New Contact</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Create a new client file in directory</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-[var(--text-secondary)] hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateContact}>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-[var(--text-secondary)]">Full Name *</Label>
                  <Input
                    id="fullName"
                    required
                    placeholder="Jane Doe"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-[var(--text-secondary)]">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+91 98765 43210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-[var(--text-secondary)]">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs font-semibold text-[var(--text-secondary)]">Initial Category / Lead Status</Label>
                  <select
                    id="category"
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-white outline-none focus:border-[var(--gold-500)] cursor-pointer"
                  >
                    <option value="">Select Category...</option>
                    {initialCategories.map((c) => (
                      <option key={c.id} value={c.id.toString()}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned Agent Selection (Admin Only) */}
                {userRole === 'admin' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="agent" className="text-xs font-semibold text-[var(--text-secondary)]">Assigned Agent</Label>
                    <select
                      id="agent"
                      value={newAgentId}
                      onChange={(e) => setNewAgentId(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-white outline-none focus:border-[var(--gold-500)] cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {initialAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs font-semibold text-[var(--text-secondary)]">Notes & Additional Details</Label>
                  <textarea
                    id="notes"
                    rows={3}
                    placeholder="Enter any contact notes or background info..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-1 focus:ring-[var(--gold-500)]/20 outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-4 border-t border-[var(--border-subtle)] bg-[#1f222b] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  className="bg-transparent border-[var(--border-default)] text-white hover:bg-[var(--bg-hover)]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md min-w-[90px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Save Contact'
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CallLogModal — controlled by table row PhoneCall button */}
      {logCallContact && (
        <CallLogModal
          contactId={logCallContact.id}
          contactName={logCallContact.name}
          currentStatus={logCallContact.status}
          externalOpen={true}
          onClose={() => setLogCallContact(null)}
        />
      )}
    </div>
  )
}
