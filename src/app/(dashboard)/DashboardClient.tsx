'use client'

import React from 'react'
import { useUser } from '@/lib/context/UserContext'
import AgentDashboard from './AgentDashboard'
import AdminDashboard from './AdminDashboard'
import { Loader2 } from 'lucide-react'

export default function DashboardClient() {
  const { profile, loading } = useUser()

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-500)]" />
          <p className="text-sm text-[var(--text-secondary)]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-center">
        <div className="max-w-md space-y-3">
          <h2 className="text-lg font-bold text-white">Access Denied</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            We couldn't retrieve your user profile. Please try logging in again.
          </p>
        </div>
      </div>
    )
  }

  if (profile.role === 'admin') {
    return <AdminDashboard />
  }

  return <AgentDashboard />
}
