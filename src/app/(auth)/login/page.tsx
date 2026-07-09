'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Shield, Loader2, KeyRound, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showIdleMessage, setShowIdleMessage] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reason') === 'idle') {
        setShowIdleMessage(true)
        // Clean url params to avoid showing warning repeatedly on manual refresh
        const newUrl = window.location.pathname
        window.history.replaceState({}, document.title, newUrl)
        toast.error('You have been logged out due to inactivity.', {
          duration: 6000,
        })
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter both email and password.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(error.message || 'Invalid email or password.')
      } else {
        toast.success('Successfully logged in!')
        // Force router refresh and navigation to dashboard
        router.refresh()
        router.push('/')
      }
    } catch (err: any) {
      toast.error('An error occurred during login. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center mesh-bg px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Mesh background subtle darken overlay */}
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] pointer-events-none" />
      
      {/* Background gradients and glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--gold-700)]/15 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

      <Card className="w-full max-w-md bg-slate-950/45 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden rounded-2xl">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)]/40 to-transparent" />
        
        <CardHeader className="space-y-1 pt-8 pb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gold-500)]/10 text-[var(--gold-400)] mb-4 border border-[var(--gold-500)]/30 shadow-[0_0_20px_rgba(212,168,83,0.15)]">
            <Shield className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
            Loveworld India Call Center
          </CardTitle>
          <CardDescription className="text-[var(--text-secondary)] text-sm">
            Sign in to access your agent dashboard
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pb-8">
            {showIdleMessage && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-200 text-xs text-center font-medium">
                You have been logged out due to inactivity. Please sign in again.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[var(--text-muted)]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="agent@loveworldindia.org"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-900/60 border-white/10 text-white placeholder-slate-500 focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20 focus-visible:ring-[var(--gold-500)]/20 transition-all duration-200"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Password</Label>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[var(--text-muted)]" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-900/60 border-white/10 text-white placeholder-slate-500 focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20 focus-visible:ring-[var(--gold-500)]/20 transition-all duration-200"
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="pb-8">
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-bold py-2.5 rounded-lg shadow-[0_4px_20px_rgba(212,168,83,0.25)] hover:shadow-[0_4px_25px_rgba(212,168,83,0.45)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
