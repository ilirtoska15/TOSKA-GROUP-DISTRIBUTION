import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  count?: number
  action?: ReactNode
}

export function PageHeader({ title, description, count, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500">{description}</p>}
        {count !== undefined && !description && (
          <p className="text-sm text-gray-500">{count} gjithsej</p>
        )}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  )
}
