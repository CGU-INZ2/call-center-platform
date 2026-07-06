'use client'

import React, { useState } from 'react'
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
  const router = useRouter()
  const supabase = createClient()

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-root)] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradients and glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--gold-700)]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-lg)] relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
        
        <CardHeader className="space-y-1 pt-8 pb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold-500)]/10 text-[var(--gold-400)] mb-4 border border-[var(--gold-500)]/20 shadow-[0_0_15px_rgba(212,168,83,0.1)]">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Vanguard Portal</CardTitle>
          <CardDescription className="text-[var(--text-secondary)] text-sm">
            Sign in to access your agent dashboard
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-[var(--text-secondary)]">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[var(--text-muted)]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@vanguard.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20 focus-visible:ring-[var(--gold-500)]/20"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-[var(--text-secondary)]">Password</Label>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[var(--text-muted)]" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20 focus-visible:ring-[var(--gold-500)]/20"
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="pb-8">
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md transition-all duration-200"
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
