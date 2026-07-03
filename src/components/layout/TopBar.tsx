import { Bell, Search, UserCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function TopBar() {
  return (
    <header className="h-16 border-b border-[var(--border-default)] bg-[var(--bg-root)] flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex-1 flex items-center">
        <div className="relative w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
          <Input 
            type="search" 
            placeholder="Search contacts, calls..." 
            className="pl-9 bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] focus-visible:ring-[var(--gold-400)] h-9"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-[var(--text-muted)] hover:text-white relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--danger)] rounded-full border-2 border-[var(--bg-root)]"></span>
        </Button>
        <Button variant="ghost" size="icon" className="text-[var(--text-muted)] hover:text-white">
          <UserCircle className="w-6 h-6" />
        </Button>
      </div>
    </header>
  )
}
