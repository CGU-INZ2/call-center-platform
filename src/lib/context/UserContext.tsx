'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  role: 'admin' | 'agent'
  full_name: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UserContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchUserAndProfile = async () => {
    try {
      setLoading(true)
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !currentUser) {
        setUser(null)
        setProfile(null)
        return
      }

      setUser(currentUser)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
        setProfile(null)
      } else {
        setProfile(profileData)
      }
    } catch (err) {
      console.error('UserContext initialization error:', err)
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserAndProfile()

    // Listen for auth state changes (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        await fetchUserAndProfile()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setLoading(false)
      } else if (event === 'USER_UPDATED') {
        await fetchUserAndProfile()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Inactivity / Idle Auto-logout check (30 minutes)
  useEffect(() => {
    if (!user) return

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes
    let timeoutId: NodeJS.Timeout

    const handleSignOut = async () => {
      console.log('Session idle. Logging out...')
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.error('Error signing out during idle check:', err)
      }
      // Force full reload/redirect to login page with idle reason
      window.location.href = '/login?reason=idle'
    }

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(handleSignOut, INACTIVITY_TIMEOUT)
    }

    // Set initial timer
    resetTimer()

    // Activity listeners
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [user])

  return (
    <UserContext.Provider value={{ user, profile, loading, refresh: fetchUserAndProfile }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
