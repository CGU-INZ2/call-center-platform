'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Phone, Clock, BarChart2, Settings, HeadphonesIcon, LogOut, Upload, Heart } from 'lucide-react'
import { SidebarItem } from './SidebarItem'
import { useUser } from '@/lib/context/UserContext'
import { createClient } from '@/lib/supabase/client'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile } = useUser()
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'

  const navItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/' },
    { icon: Users, label: 'Contacts', href: '/contacts' },
    { icon: Clock, label: 'Follow-ups', href: '/followups' },
    { icon: Heart, label: 'Prayers', href: '/prayers' },
    { icon: Phone, label: 'Calls', href: '/calls' },
    { icon: BarChart2, label: 'Analytics', href: '/analytics' },
    ...(isAdmin ? [
      { icon: Upload, label: 'Import Contacts', href: '/settings/import' },
      { icon: Settings, label: 'WA Templates', href: '/settings/templates' },
      { icon: Settings, label: 'User Settings', href: '/settings/users' }
    ] : []),
  ]

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.substring(0, 2).toUpperCase() || 'US'

  return (
    <aside className="w-[260px] h-screen bg-[#1a1d25] border-r border-[#2a2d38] flex flex-col fixed left-0 top-0 z-40">
      <div className="h-16 flex items-center px-6 border-b border-[#2a2d38]">
        <div className="flex items-center gap-2 text-[#e4bc4a]">
          <HeadphonesIcon className="w-6 h-6" />
          <span className="font-semibold text-lg tracking-wide text-white">Ministry<span className="text-[#e4bc4a]">CC</span></span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
        <div className="text-xs font-semibold text-[#5a5e72] mb-2 px-3 uppercase tracking-wider">
          Main Menu
        </div>
        {navItems.map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
          />
        ))}
      </div>
      
      <div className="p-4 border-t border-[#2a2d38] flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-[var(--gold-500)]/20 border border-[var(--gold-500)]/30 flex items-center justify-center text-xs font-bold text-[var(--gold-400)] shrink-0">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-white truncate">{profile?.full_name || 'User'}</span>
            <span className="text-xs text-[#8b8fa3] truncate">{user?.email}</span>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-2 text-[#8b8fa3] hover:text-white rounded-md hover:bg-[#282c38] transition-colors shrink-0"
          title="Sign Out"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </aside>
  )
}

