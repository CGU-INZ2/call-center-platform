'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard layout error:', error)
  }, [error])

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-6 text-center bg-[var(--bg-root)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] text-red-500 mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Dashboard View Error</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
        An error occurred while loading this dashboard view. You can try to reset the view or navigate back.
      </p>
      {error.message && (
        <pre className="mt-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] max-w-md text-left text-xs font-[var(--font-jbmono)] text-red-400 overflow-auto">
          {error.message}
        </pre>
      )}
      <div className="mt-6 flex gap-4">
        <Button
          onClick={reset}
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Try Again
        </Button>
        <Button
          onClick={() => window.location.reload()}
          size="sm"
          className="gap-2 text-xs bg-[var(--gold-500)] text-black hover:bg-[var(--gold-600)]"
        >
          Reload Page
        </Button>
      </div>
    </div>
  )
}
