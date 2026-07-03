import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  href: string
  isActive?: boolean
}

export function SidebarItem({ icon: Icon, label, href, isActive }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors border-l-2 border-transparent",
        isActive 
          ? "bg-[var(--bg-hover)] text-white border-l-[var(--gold-400)]" 
          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{label}</span>
    </Link>
  )
}
