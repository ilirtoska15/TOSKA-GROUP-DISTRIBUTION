import Link from 'next/link'
import type { ComponentType } from 'react'

const colorMap = {
  blue:    { grad: 'from-blue-50 to-white',    icon: 'bg-blue-500',    border: 'border-blue-100' },
  green:   { grad: 'from-green-50 to-white',   icon: 'bg-green-500',   border: 'border-green-100' },
  emerald: { grad: 'from-emerald-50 to-white', icon: 'bg-emerald-500', border: 'border-emerald-100' },
  red:     { grad: 'from-red-50 to-white',     icon: 'bg-red-500',     border: 'border-red-100' },
  indigo:  { grad: 'from-indigo-50 to-white',  icon: 'bg-indigo-500',  border: 'border-indigo-100' },
  purple:  { grad: 'from-purple-50 to-white',  icon: 'bg-purple-500',  border: 'border-purple-100' },
  orange:  { grad: 'from-orange-50 to-white',  icon: 'bg-orange-500',  border: 'border-orange-100' },
  yellow:  { grad: 'from-yellow-50 to-white',  icon: 'bg-yellow-500',  border: 'border-yellow-100' },
}

export type StatCardColor = keyof typeof colorMap

interface StatCardProps {
  title: string
  value: string
  icon: ComponentType<{ className?: string }>
  color: StatCardColor
  href: string
}

export function StatCard({ title, value, icon: Icon, color, href }: StatCardProps) {
  const c = colorMap[color] ?? colorMap.blue
  return (
    <Link href={href}>
      <div className={`bg-gradient-to-br ${c.grad} rounded-2xl border ${c.border} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200`}>
        <div className={`w-10 h-10 ${c.icon} rounded-xl flex items-center justify-center shadow-sm mb-3`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs font-medium text-slate-500 mt-1.5 uppercase tracking-wide">{title}</p>
      </div>
    </Link>
  )
}
