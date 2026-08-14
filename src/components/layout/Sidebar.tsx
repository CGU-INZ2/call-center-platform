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

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

  const navItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/' },
    { icon: Users, label: 'Contacts', href: '/contacts' },
    { icon: Clock, label: 'Follow-ups', href: '/followups' },
    { icon: Heart, label: 'Prayers', href: '/prayers' },
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
    <aside className="w-[220px] h-screen bg-[#1a1d25] border-r border-[#2a2d38] flex flex-col fixed left-0 top-0 z-40">
      {/* Logo area */}
      <div className="h-14 flex items-center px-4 border-b border-[#2a2d38]">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-[var(--gold-400)] flex items-center justify-center shrink-0">
            <HeadphonesIcon className="w-[14px] h-[14px] text-[#0f1117]" />
          </div>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Ministry<span className="text-[var(--gold-400)]">CC</span>
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-4 px-2.5 flex flex-col gap-[3px]">
        <div className="text-[10px] font-semibold text-[var(--text-muted)] mb-2 px-2.5 uppercase tracking-wider">
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

      {/* User footer */}
      <div className="p-3 border-t border-[#2a2d38] flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Initials circle */}
          <div className="w-[26px] h-[26px] rounded-full bg-[#282c38] flex items-center justify-center text-[10px] font-semibold text-[var(--gold-400)] shrink-0">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
              {profile?.full_name || 'User'}
            </span>
            {/* Availability indicator — pulse-green is a legitimate operational signal */}
            <span className="text-[11px] text-[var(--success)] flex items-center gap-1">
              <span
                className="w-[5px] h-[5px] rounded-full bg-[var(--success)] inline-block dot-pulse-green"
              />
              Available
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="p-1.5 text-[var(--text-muted)] hover:text-white rounded-md hover:bg-[#282c38] transition-colors shrink-0"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
