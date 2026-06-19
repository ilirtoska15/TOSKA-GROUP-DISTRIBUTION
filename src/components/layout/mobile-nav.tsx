'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck,
  DollarSign, RotateCcw, MapPin, Warehouse, ClipboardList, Boxes
} from 'lucide-react'

interface MobileNavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
}

const MOBILE_NAV: MobileNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { href: '/admin/orders', label: 'Porosi', icon: ShoppingCart, roles: ['ADMIN'] },
  { href: '/admin/customers', label: 'Klientë', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/products', label: 'Produkte', icon: Package, roles: ['ADMIN'] },
  { href: '/admin/payments', label: 'Pagesa', icon: DollarSign, roles: ['ADMIN'] },

  { href: '/agjent', label: 'Dashboard', icon: LayoutDashboard, roles: ['AGJENT'] },
  { href: '/agjent/visits', label: 'Vizita', icon: MapPin, roles: ['AGJENT'] },
  { href: '/agjent/orders', label: 'Porosi', icon: ShoppingCart, roles: ['AGJENT'] },
  { href: '/agjent/catalog', label: 'Katalog', icon: Package, roles: ['AGJENT'] },
  { href: '/agjent/payments', label: 'Pagesa', icon: DollarSign, roles: ['AGJENT'] },

  { href: '/shofer', label: 'Dashboard', icon: LayoutDashboard, roles: ['SHOFER'] },
  { href: '/shofer/rruga', label: 'Rruga', icon: MapPin, roles: ['SHOFER'] },
  { href: '/shofer/deliveries', label: 'Dërgesa', icon: Truck, roles: ['SHOFER'] },
  { href: '/shofer/payments', label: 'Pagesa', icon: DollarSign, roles: ['SHOFER'] },
  { href: '/shofer/returns', label: 'Kthime', icon: RotateCcw, roles: ['SHOFER'] },

  { href: '/depoist', label: 'Dashboard', icon: LayoutDashboard, roles: ['DEPOIST'] },
  { href: '/depoist/orders', label: 'Porosi', icon: ClipboardList, roles: ['DEPOIST'] },
  { href: '/depoist/inventory', label: 'Inventar', icon: Warehouse, roles: ['DEPOIST'] },
  { href: '/depoist/stock', label: 'Stok', icon: Boxes, roles: ['DEPOIST'] },
  { href: '/depoist/returns', label: 'Kthime', icon: RotateCcw, roles: ['DEPOIST'] },
]

export function MobileNav({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const items = MOBILE_NAV.filter((item) => item.roles.includes(userRole))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex lg:hidden pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 min-w-0 transition-colors',
              isActive ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-xl transition-colors',
              isActive ? 'bg-primary/10' : ''
            )}>
              <Icon className="h-5 w-5 shrink-0" />
            </div>
            <span className={cn('text-[10px] truncate transition-all', isActive ? 'font-bold' : 'font-medium')}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
