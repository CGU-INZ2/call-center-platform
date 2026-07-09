'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function HotkeyListener() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )

      // Esc key: blur current active input
      if (event.key === 'Escape') {
        if (activeElement && typeof (activeElement as HTMLElement).blur === 'function') {
          (activeElement as HTMLElement).blur()
        }
        return
      }

      // / key: focus search input if not currently typing in an input
      if (event.key === '/' && !isInput) {
        event.preventDefault()
        const searchInput = document.getElementById('topbar-search-input')
        if (searchInput) {
          searchInput.focus()
          // Optionally select text inside the search input
          if ('select' in searchInput && typeof searchInput.select === 'function') {
            searchInput.select()
          }
        }
        return
      }

      // N / n key: navigate to new contact if not typing in an input
      if ((event.key === 'N' || event.key === 'n') && !isInput) {
        event.preventDefault()
        router.push('/contacts/new')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return null
}
