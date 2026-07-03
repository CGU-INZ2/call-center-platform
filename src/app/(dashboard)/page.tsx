import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, Users, Clock, ArrowUpRight } from 'lucide-react'

export default function DashboardOverview() {
  const stats = [
    { title: 'Total Calls Today', value: '1,248', icon: Phone, trend: '+12%' },
    { title: 'Active Agents', value: '45', icon: Users, trend: 'Stable' },
    { title: 'Avg Handle Time', value: '4m 12s', icon: Clock, trend: '-8%' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Overview" 
        description="Monitor today's call center performance and agent activity."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-[var(--bg-surface)] border-[var(--border-default)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className="text-xs text-[var(--success)] flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                {stat.trend} from yesterday
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
