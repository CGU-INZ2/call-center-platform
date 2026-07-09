'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
            {this.state.error?.message || 'An unexpected error occurred in this application view.'}
          </p>
          <div className="mt-6 flex gap-4">
            <Button
              onClick={this.handleReset}
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

    return this.props.children
  }
}

export default ErrorBoundary
