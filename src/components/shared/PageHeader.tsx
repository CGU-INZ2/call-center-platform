import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-white tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
