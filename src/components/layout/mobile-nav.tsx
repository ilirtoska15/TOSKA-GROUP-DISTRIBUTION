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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex lg:hidden pb-safe">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 transition-colors min-w-0',
              isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
