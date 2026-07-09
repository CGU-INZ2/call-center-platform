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
        // Base: compact density matching the mockup
        "flex items-center gap-2 px-2.5 py-[7px] text-xs transition-colors duration-150",
        isActive
          // Active: flat left-bar highlight (no rounded left edge), gold accent
          ? "bg-[#282c38] border-l-[3px] border-[var(--gold-400)] text-[var(--text-primary)] pl-[7px]"
          // Inactive: rounded, muted, hover bg
          : "rounded-md border-l-[3px] border-transparent text-[var(--text-secondary)] hover:bg-[#282c38] hover:text-[var(--text-primary)] pl-[7px]"
      )}
    >
      <Icon className="w-[15px] h-[15px] shrink-0" />
      <span className="font-medium">{label}</span>
    </Link>
  )
}
