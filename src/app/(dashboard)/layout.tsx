import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-root)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="pl-[260px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
