'use client'

import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Phone, BarChart2, Settings, HeadphonesIcon } from 'lucide-react'
import { SidebarItem } from './SidebarItem'

export function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/' },
    { icon: Users, label: 'Contacts', href: '/contacts' },
    { icon: Phone, label: 'Calls', href: '/calls' },
    { icon: BarChart2, label: 'Analytics', href: '/analytics' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ]

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
      
      <div className="p-4 border-t border-[#2a2d38]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#2a2d38] flex items-center justify-center text-xs font-bold text-white">
            AD
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">Admin User</span>
            <span className="text-xs text-[#8b8fa3]">admin@ministry.com</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
