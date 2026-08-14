'use client'

import React, { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  Loader2, 
  UserPlus, 
  Shield, 
  Mail, 
  KeyRound, 
  User as UserIcon, 
  Calendar, 
  Search, 
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { useUser } from '@/lib/context/UserContext'

interface UserRecord {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'agent'
  is_active: boolean
  phone: string | null
  created_at: string
  last_sign_in_at: string | null
}

export default function UserManagementClient() {
  const { user: currentUser } = useUser()

  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  
  // Deletion modal state
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'agent'>('agent')
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err: any) {
      console.error(err)
      toast.error('Could not load users list. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName || !email || !password || !role) {
      toast.error('Please fill out all fields.')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      toast.success('User account created successfully!')
      
      // Reset form fields
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('agent')
      
      // Refresh list
      await fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while creating the user.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRoleChange = async (
    targetUserId: string,
    newRole: 'admin' | 'agent',
    targetUserName: string
  ) => {
    if (currentUser?.id === targetUserId && newRole !== 'admin') {
      toast.error('You cannot demote your own administrator account.')
      return
    }

    setUpdatingUserId(targetUserId)
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user role')
      }

      // Optimistically update local users state
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
      )

      toast.success(
        `Updated ${targetUserName}'s access role to ${
          newRole === 'admin' ? 'Administrator' : 'Call Agent'
        }.`
      )
    } catch (err: any) {
      console.error('Error changing user role:', err)
      toast.error(err.message || 'Failed to update access role.')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    if (currentUser?.id === userToDelete.id) {
      toast.error('You cannot delete your own administrator account.')
      setUserToDelete(null)
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      // Optimistically remove from state
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
      toast.success(`Removed account for ${userToDelete.full_name}.`)
      setUserToDelete(null)
    } catch (err: any) {
      console.error('Error deleting user:', err)
      toast.error(err.message || 'Failed to delete user account.')
    } finally {
      setDeleting(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const term = searchQuery.toLowerCase()
    return (
      user.full_name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.role.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Settings" 
        description="Provision new agent accounts, configure administrative privileges, and monitor team status."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Creation Form Card */}
        <div className="lg:col-span-4">
          <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-md)] relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 items-center justify-center flex rounded-full bg-[var(--gold-500)]/10 text-[var(--gold-400)] border border-[var(--gold-500)]/20 shadow-[0_0_10px_rgba(212,168,83,0.05)]">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-white">Create Member</CardTitle>
                  <CardDescription className="text-xs text-[var(--text-secondary)]">
                    Add new administrator or call agent
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pb-6">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-[var(--text-secondary)]">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <Input
                      id="fullName"
                      placeholder="Jane Doe"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20"
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-[var(--text-secondary)]">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="jane@loveworldindia.org"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20"
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Temp Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-[var(--text-secondary)]">Temporary Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20"
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Role Select */}
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-semibold text-[var(--text-secondary)]">System Access Role</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] z-10 pointer-events-none" />
                    <Select
                      value={role}
                      onValueChange={(val) => setRole(val as 'admin' | 'agent')}
                      disabled={submitting}
                    >
                      <SelectTrigger className="w-full bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus:border-[var(--gold-500)] pl-10 h-9">
                        <SelectValue placeholder="Select Access Role" />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--bg-surface)] border-[var(--border-default)]">
                        <SelectItem value="agent">Call Agent</SelectItem>
                        <SelectItem value="admin">System Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md transition-all duration-200 h-9"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Provision Account'
                  )}
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>

        {/* Directory Grid */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls Bar */}
          <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] py-3 px-4 shadow-[var(--shadow-sm)] flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <Input
                placeholder="Search by name, email, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)]"
              />
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              Showing <span className="font-semibold text-white">{filteredUsers.length}</span> of <span className="font-semibold text-white">{users.length}</span> users
            </div>
          </Card>

          {/* Table Card */}
          <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-md)] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#1f222b] border-b border-[var(--border-default)]">
                  <TableRow className="hover:bg-transparent border-[var(--border-default)]">
                    <TableHead className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase">User</TableHead>
                    <TableHead className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase">Access Role</TableHead>
                    <TableHead className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase">Account Status</TableHead>
                    <TableHead className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase">Registration</TableHead>
                    <TableHead className="text-[var(--text-muted)] font-semibold py-3 px-4 text-xs tracking-wider uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i} className="border-[var(--border-default)] hover:bg-transparent animate-pulse">
                        <TableCell className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)]" />
                            <div className="space-y-1">
                              <div className="h-4 w-28 bg-[var(--bg-elevated)] rounded" />
                              <div className="h-3 w-40 bg-[var(--bg-elevated)] rounded" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="h-5 w-24 bg-[var(--bg-elevated)] rounded-md" />
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="h-4 w-20 bg-[var(--bg-elevated)] rounded" />
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="h-4 w-24 bg-[var(--bg-elevated)] rounded" />
                        </TableCell>
                        <TableCell className="py-4 px-4 text-right">
                          <div className="h-7 w-7 bg-[var(--bg-elevated)] rounded ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">
                        No team members found. Try refining your search query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const initials = user.full_name
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                      
                      const formattedDate = new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })

                      const isCurrentLoggedInUser = user.id === currentUser?.id
                      const isUpdatingThisUser = updatingUserId === user.id

                      return (
                        <TableRow key={user.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors">
                          {/* User Avatar + Info */}
                          <TableCell className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[var(--gold-500)]/15 border border-[var(--gold-500)]/20 text-[var(--gold-400)] flex items-center justify-center font-bold text-sm shrink-0">
                                {initials}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white truncate">{user.full_name}</span>
                                  {isCurrentLoggedInUser && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--gold-500)]/20 text-[var(--gold-400)] font-medium border border-[var(--gold-500)]/30">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-[var(--text-secondary)] truncate">{user.email}</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Access Role Selector / Changer */}
                          <TableCell className="py-3.5 px-4">
                            {isCurrentLoggedInUser ? (
                              <Badge 
                                variant="outline"
                                className="bg-[var(--gold-500)]/10 text-[var(--gold-400)] border-[var(--gold-500)]/30 px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 w-fit"
                              >
                                <Shield className="w-3.5 h-3.5 text-[var(--gold-400)]" />
                                Administrator
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={user.role}
                                  onValueChange={(newRole) =>
                                    handleRoleChange(user.id, newRole as 'admin' | 'agent', user.full_name)
                                  }
                                  disabled={isUpdatingThisUser}
                                >
                                  <SelectTrigger 
                                    className={`h-7.5 w-[130px] text-xs border rounded-md transition-all ${
                                      user.role === 'admin'
                                        ? 'bg-[var(--gold-500)]/10 text-[var(--gold-400)] border-[var(--gold-500)]/40 hover:bg-[var(--gold-500)]/20'
                                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                                    }`}
                                  >
                                    {isUpdatingThisUser ? (
                                      <div className="flex items-center gap-1.5 text-xs text-[var(--gold-400)]">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Saving...</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Shield
                                          className={`w-3.5 h-3.5 shrink-0 ${
                                            user.role === 'admin'
                                              ? 'text-[var(--gold-400)]'
                                              : 'text-[var(--text-muted)]'
                                          }`}
                                        />
                                        <span className="truncate">
                                          {user.role === 'admin' ? 'Administrator' : 'Call Agent'}
                                        </span>
                                      </div>
                                    )}
                                  </SelectTrigger>
                                  <SelectContent className="bg-[var(--bg-surface)] border-[var(--border-default)] text-white">
                                    <SelectItem value="agent" className="text-xs focus:bg-[var(--bg-hover)]">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                                        <span>Call Agent</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="admin" className="text-xs focus:bg-[var(--bg-hover)]">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[var(--gold-400)]" />
                                        <span>Administrator</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </TableCell>

                          {/* Account Status */}
                          <TableCell className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {user.is_active ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                                  <span className="text-xs text-white">Active</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-[var(--danger)]" />
                                  <span className="text-xs text-[var(--text-secondary)]">Disabled</span>
                                </>
                              )}
                            </div>
                          </TableCell>

                          {/* Registration Date */}
                          <TableCell className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {formattedDate}
                            </div>
                          </TableCell>

                          {/* Actions: Delete Account */}
                          <TableCell className="py-3.5 px-4 text-right">
                            {isCurrentLoggedInUser ? (
                              <span className="text-xs text-[var(--text-muted)] italic">—</span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUserToDelete(user)}
                                className="h-7.5 w-7.5 p-0 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-muted)]/20 transition-colors rounded-md"
                                title={`Delete ${user.full_name}'s account`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && !deleting && setUserToDelete(null)}>
        <DialogContent className="bg-[var(--bg-surface)] border-[var(--border-default)] text-white sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-[var(--danger-muted)]/30 border border-[var(--danger)]/30 text-[var(--danger)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base font-bold text-white">
                Delete User Account
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to delete the account for <strong className="text-white">{userToDelete?.full_name}</strong> (<span className="text-[var(--gold-400)]">{userToDelete?.email}</span>)?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-1.5">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
              This action cannot be undone.
            </p>
            <p>
              The user will immediately lose access to the system. All historical call logs and records created by this user will be safely preserved.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserToDelete(null)}
              disabled={deleting}
              className="bg-transparent border-[var(--border-default)] text-white hover:bg-[var(--bg-hover)] text-xs h-8.5"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white font-semibold text-xs h-8.5 shadow-md flex items-center gap-1.5 ml-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting Account...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Delete</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
