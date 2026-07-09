import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between pb-4">
      <div className="space-y-0.5">
        <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
