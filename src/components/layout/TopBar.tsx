'use client'

import { Bell, Search, UserCircle, Loader2, Plus, Phone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ContactResult {
  id: string
  full_name: string
  phone: string
  assigned_agent_id: string | null
}

interface TopBarProps {
  queueCount?: number
}

export function TopBar({ queueCount = 0 }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<ContactResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const lookupPhone = async () => {
      if (searchQuery.trim().length < 3) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const res = await fetch(`/api/contacts/lookup?phone=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        if (data.contacts) {
          setResults(data.contacts)
        }
      } catch (err) {
        console.error('Failed to lookup phone:', err)
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(lookupPhone, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleResultClick = (contactId: string) => {
    setShowDropdown(false)
    setSearchQuery('')
    router.push(`/contacts/${contactId}`)
  }

  const handleCreateContact = () => {
    setShowDropdown(false)
    const cleanNumber = searchQuery.replace(/[^0-9+]/g, '')
    setSearchQuery('')
    router.push(`/contacts?create=${encodeURIComponent(cleanNumber)}`)
  }

  const isNumericInput = searchQuery.trim().length >= 3 && /^[0-9+\s()-]+$/.test(searchQuery)

  return (
    <header className="h-14 border-b border-[var(--border-default)] bg-[var(--bg-root)] flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex-1 flex items-center">
        <div ref={containerRef} className="relative w-80">
          <Search className="absolute left-2.5 top-2.5 h-[14px] w-[14px] text-[var(--text-muted)]" />
          <Input
            id="topbar-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Phone lookup (e.g. 98765...)"
            className="pl-8 h-8 text-xs bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:ring-[var(--gold-400)] w-full"
          />
          {showDropdown && searchQuery.trim().length >= 3 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] shadow-[var(--shadow-md)] z-50 overflow-hidden max-h-60 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-4 text-[var(--text-muted)] text-xs">
                  <Loader2 className="w-3 h-3 animate-spin mr-2" />
                  Searching...
                </div>
              )}
              {!isLoading && results.length > 0 && (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)] uppercase tracking-wider">
                    Matching Contacts
                  </div>
                  {results.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleResultClick(contact.id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-between transition-colors"
                    >
                      <div className="font-medium">{contact.full_name}</div>
                      <div className="text-[var(--text-secondary)] flex items-center gap-1 font-[var(--font-jbmono)]">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!isLoading && results.length === 0 && (
                <div className="p-3 text-center text-xs text-[var(--text-secondary)]">
                  No contacts found.
                </div>
              )}
              {isNumericInput && (
                <button
                  onClick={handleCreateContact}
                  className="w-full text-left px-3 py-2 text-xs bg-[var(--gold-500)]/10 hover:bg-[var(--gold-500)]/20 text-[var(--gold-400)] flex items-center gap-2 border-t border-[var(--border-default)] transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Contact: {searchQuery}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Queue count pill — gold pulse dot is the ONE animated element in the topbar */}
        {queueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 bg-[#22252f] border border-[#2a2d38] px-2.5 py-1 rounded-full text-[11px] text-[var(--text-secondary)]">
            <span
              className="w-[6px] h-[6px] rounded-full bg-[var(--gold-400)] inline-block dot-pulse-gold"
            />
            <span className="font-[var(--font-jbmono)] text-[var(--text-primary)] font-medium">
              {queueCount}
            </span>
            {' '}in queue
          </span>
        )}

        {/* Bell — static red dot, no animation */}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--text-muted)] hover:text-white relative">
          <Bell className="w-[15px] h-[15px]" />
          <span className="absolute top-1.5 right-1.5 w-[6px] h-[6px] bg-[var(--danger)] rounded-full border border-[var(--bg-root)]" />
        </Button>

        <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--text-muted)] hover:text-white">
          <UserCircle className="w-[15px] h-[15px]" />
        </Button>
      </div>
    </header>
  )
}
