'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck,
  DollarSign, RotateCcw, MapPin, Warehouse, ClipboardList,
  Boxes, MoreHorizontal
} from 'lucide-react'

interface MobileNavLink {
  type: 'link'
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
}

interface MobileNavMore {
  type: 'more'
  label: string
  icon: React.ElementType
  roles: string[]
}

type MobileNavItem = MobileNavLink | MobileNavMore

const MOBILE_NAV: MobileNavItem[] = [
  // ── ADMIN ────────────────────────────────────────────────────────────────
  { type: 'link', href: '/admin',            label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { type: 'link', href: '/admin/orders',     label: 'Porosi',    icon: ShoppingCart,    roles: ['ADMIN'] },
  { type: 'link', href: '/admin/customers',  label: 'Klientë',   icon: Users,           roles: ['ADMIN'] },
  { type: 'link', href: '/admin/products',   label: 'Produkte',  icon: Package,         roles: ['ADMIN'] },
  { type: 'link', href: '/admin/payments',   label: 'Pagesa',    icon: DollarSign,      roles: ['ADMIN'] },

  // ── AGJENT ───────────────────────────────────────────────────────────────
  { type: 'link', href: '/agjent',           label: 'Dashboard', icon: LayoutDashboard, roles: ['AGJENT'] },
  { type: 'link', href: '/agjent/visits',    label: 'Vizita',    icon: MapPin,          roles: ['AGJENT'] },
  { type: 'link', href: '/agjent/orders',    label: 'Porosi',    icon: ShoppingCart,    roles: ['AGJENT'] },
  { type: 'link', href: '/agjent/customers', label: 'Klientë',   icon: Users,           roles: ['AGJENT'] },
  { type: 'more',                            label: 'Më shumë',  icon: MoreHorizontal,  roles: ['AGJENT'] },

  // ── SHOFER ───────────────────────────────────────────────────────────────
  { type: 'link', href: '/shofer',              label: 'Dashboard', icon: LayoutDashboard, roles: ['SHOFER'] },
  { type: 'link', href: '/shofer/rruga',        label: 'Rruga',     icon: MapPin,          roles: ['SHOFER'] },
  { type: 'link', href: '/shofer/deliveries',   label: 'Dërgesa',   icon: Truck,           roles: ['SHOFER'] },
  { type: 'link', href: '/shofer/payments',     label: 'Pagesa',    icon: DollarSign,      roles: ['SHOFER'] },
  { type: 'more',                               label: 'Më shumë',  icon: MoreHorizontal,  roles: ['SHOFER'] },

  // ── DEPOIST ──────────────────────────────────────────────────────────────
  { type: 'link', href: '/depoist',             label: 'Dashboard', icon: LayoutDashboard, roles: ['DEPOIST'] },
  { type: 'link', href: '/depoist/orders',      label: 'Porosi',    icon: ClipboardList,   roles: ['DEPOIST'] },
  { type: 'link', href: '/depoist/inventory',   label: 'Inventar',  icon: Warehouse,       roles: ['DEPOIST'] },
  { type: 'link', href: '/depoist/stock',       label: 'Stok',      icon: Boxes,           roles: ['DEPOIST'] },
  { type: 'link', href: '/depoist/returns',     label: 'Kthime',    icon: RotateCcw,       roles: ['DEPOIST'] },
]

function openDrawer() {
  window.dispatchEvent(new CustomEvent('toggle-mobile-menu'))
}

export function MobileNav({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const items = MOBILE_NAV.filter((item) => item.roles.includes(userRole))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex lg:hidden pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      {items.map((item) => {
        if (item.type === 'more') {
          const Icon = item.icon
          return (
            <button
              key="more"
              onClick={openDrawer}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 min-w-0 transition-colors text-gray-400 hover:text-gray-600"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors">
                <Icon className="h-5 w-5 shrink-0" />
              </div>
              <span className="text-[10px] truncate font-medium">{item.label}</span>
            </button>
          )
        }

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
