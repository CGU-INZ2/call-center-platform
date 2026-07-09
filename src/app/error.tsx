'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error('Root application error:', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-[var(--bg-root)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] text-red-500 mb-6">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Application Error</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
        A critical error occurred while loading this page. Please try resetting or contact system support.
      </p>
      {error.message && (
        <pre className="mt-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] max-w-lg text-left text-xs font-[var(--font-jbmono)] text-red-400 overflow-auto">
          {error.message}
        </pre>
      )}
      <div className="mt-8 flex gap-4">
        <Button
          onClick={reset}
          variant="outline"
          className="gap-2 text-xs"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Button
          onClick={() => window.location.reload()}
          className="gap-2 text-xs bg-[var(--gold-500)] text-black hover:bg-[var(--gold-600)]"
        >
          Reload Page
        </Button>
      </div>
    </main>
  )
}
