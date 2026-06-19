'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck,
  DollarSign, RotateCcw, AlertTriangle, BarChart3, Settings,
  MapPin, Warehouse, Target, LogOut,
  ChevronLeft, ChevronRight, Building2, Car, Receipt,
  Shield, ClipboardList, TrendingUp, Boxes, Bell
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
  group?: string
}

export const NAV_ITEMS: NavItem[] = [
  // ── ADMIN — OPERACIONET ──────────────────────────────────────────────────
  { href: '/admin',             label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'], group: 'OPERACIONET' },
  { href: '/admin/customers',   label: 'Klientët',  icon: Users,           roles: ['ADMIN'], group: 'OPERACIONET' },
  { href: '/admin/orders',      label: 'Porositë',  icon: ShoppingCart,    roles: ['ADMIN'], group: 'OPERACIONET' },
  { href: '/admin/deliveries',  label: 'Dërgesat',  icon: Truck,           roles: ['ADMIN'], group: 'OPERACIONET' },
  { href: '/admin/visits',      label: 'Vizitat',   icon: MapPin,          roles: ['ADMIN'], group: 'OPERACIONET' },

  // ── ADMIN — FINANCA ──────────────────────────────────────────────────────
  { href: '/admin/payments',    label: 'Pagesat',   icon: DollarSign,      roles: ['ADMIN'], group: 'FINANCA' },
  { href: '/admin/expenses',    label: 'Shpenzime', icon: Receipt,         roles: ['ADMIN'], group: 'FINANCA' },
  { href: '/admin/reports',     label: 'Raporte',   icon: BarChart3,       roles: ['ADMIN'], group: 'FINANCA' },

  // ── ADMIN — KATALOGU / MAGAZINA ──────────────────────────────────────────
  { href: '/admin/products',    label: 'Produktet',  icon: Package,       roles: ['ADMIN'], group: 'MAGAZINA' },
  { href: '/admin/inventory',   label: 'Inventari',  icon: Boxes,         roles: ['ADMIN'], group: 'MAGAZINA' },
  { href: '/admin/returns',     label: 'Kthimet',    icon: RotateCcw,     roles: ['ADMIN'], group: 'MAGAZINA' },
  { href: '/admin/damage',      label: 'Dëmtimet',   icon: AlertTriangle, roles: ['ADMIN'], group: 'MAGAZINA' },
  { href: '/admin/suppliers',   label: 'Furnitorët', icon: Building2,     roles: ['ADMIN'], group: 'MAGAZINA' },

  // ── ADMIN — MENAXHIMI ────────────────────────────────────────────────────
  { href: '/admin/fleet',    label: 'Flotë',        icon: Car,    roles: ['ADMIN'], group: 'MENAXHIMI' },
  { href: '/admin/targets',  label: 'Targete',      icon: Target, roles: ['ADMIN'], group: 'MENAXHIMI' },
  { href: '/admin/users',    label: 'Përdoruesit',  icon: Shield, roles: ['ADMIN'], group: 'MENAXHIMI' },

  // ── ADMIN — SISTEMI ──────────────────────────────────────────────────────
  { href: '/admin/notifications', label: 'Njoftimet',  icon: Bell,     roles: ['ADMIN'], group: 'SISTEMI' },
  { href: '/admin/config',        label: 'Konfigurim', icon: Settings, roles: ['ADMIN'], group: 'SISTEMI' },

  // ── AGJENT ───────────────────────────────────────────────────────────────
  { href: '/agjent',           label: 'Dashboard',  icon: LayoutDashboard, roles: ['AGJENT'] },
  { href: '/agjent/visits',    label: 'Vizitat',    icon: MapPin,          roles: ['AGJENT'] },
  { href: '/agjent/orders',    label: 'Porositë',   icon: ShoppingCart,    roles: ['AGJENT'] },
  { href: '/agjent/customers', label: 'Klientët',   icon: Users,           roles: ['AGJENT'] },
  { href: '/agjent/catalog',   label: 'Katalogu',   icon: Package,         roles: ['AGJENT'] },
  { href: '/agjent/payments',  label: 'Pagesat',    icon: DollarSign,      roles: ['AGJENT'] },
  { href: '/agjent/returns',   label: 'Kthimet',    icon: RotateCcw,       roles: ['AGJENT'] },
  { href: '/agjent/targets',   label: 'Targetat',   icon: TrendingUp,      roles: ['AGJENT'] },

  // ── SHOFER ───────────────────────────────────────────────────────────────
  { href: '/shofer',             label: 'Dashboard', icon: LayoutDashboard, roles: ['SHOFER'] },
  { href: '/shofer/rruga',       label: 'Rruga',     icon: MapPin,          roles: ['SHOFER'] },
  { href: '/shofer/deliveries',  label: 'Dërgesat',  icon: Truck,           roles: ['SHOFER'] },
  { href: '/shofer/payments',    label: 'Pagesat',   icon: DollarSign,      roles: ['SHOFER'] },
  { href: '/shofer/returns',     label: 'Kthimet',   icon: RotateCcw,       roles: ['SHOFER'] },

  // ── DEPOIST ──────────────────────────────────────────────────────────────
  { href: '/depoist',             label: 'Dashboard', icon: LayoutDashboard, roles: ['DEPOIST'] },
  { href: '/depoist/orders',      label: 'Porositë',  icon: ClipboardList,   roles: ['DEPOIST'] },
  { href: '/depoist/inventory',   label: 'Inventari', icon: Warehouse,       roles: ['DEPOIST'] },
  { href: '/depoist/stock',       label: 'Stoku',     icon: Boxes,           roles: ['DEPOIST'] },
  { href: '/depoist/returns',     label: 'Kthimet',   icon: RotateCcw,       roles: ['DEPOIST'] },
  { href: '/depoist/damage',      label: 'Dëmtimet',  icon: AlertTriangle,   roles: ['DEPOIST'] },
]

export function groupNavItems(items: NavItem[]): { label: string; items: NavItem[] }[] {
  const groups: { label: string; items: NavItem[] }[] = []
  for (const item of items) {
    const label = item.group ?? ''
    const existing = groups.find(g => g.label === label)
    if (existing) existing.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

const NOTIF_HREF: Record<string, string> = {
  ADMIN: '/admin/notifications',
  AGJENT: '/agjent/notifications',
  SHOFER: '/shofer/notifications',
  DEPOIST: '/depoist/notifications',
}

interface SidebarProps {
  userRole: string
  userName: string
  userEmail: string
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()

  const items = NAV_ITEMS.filter((item) => item.roles.includes(userRole))
  const hasGroups = items.some(item => item.group)

  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(d => setUnreadCount(d.unreadCount ?? 0))
        .catch(() => null)
    }
    fetchCount()
    const id = setInterval(fetchCount, 60_000)
    return () => clearInterval(id)
  }, [])

  function renderNavLink(item: NavItem) {
    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
    const Icon = item.icon
    const isNotifItem = item.href === NOTIF_HREF[userRole]
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          collapsed && 'justify-center px-2'
        )}
      >
        <span className="relative shrink-0">
          <Icon className={cn(collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {collapsed && isNotifItem && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </span>
        {!collapsed && <span className="truncate flex-1">{item.label}</span>}
        {!collapsed && isNotifItem && unreadCount > 0 && (
          <span className="ml-auto min-w-[18px] h-[18px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    )
  }

  function renderGroupedNav() {
    if (!hasGroups) {
      return items.map(item => renderNavLink(item))
    }
    const groups = groupNavItems(items)
    return groups.map(({ label, items: groupItems }, groupIndex) => (
      <div key={label || 'default'}>
        {collapsed && groupIndex > 0 && (
          <div className="border-t border-gray-100 my-1 mx-2" />
        )}
        {!collapsed && label && (
          <p className={cn(
            'text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pb-1',
            groupIndex === 0 ? 'pt-1' : 'pt-4'
          )}>
            {label}
          </p>
        )}
        {groupItems.map(item => renderNavLink(item))}
      </div>
    ))
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">TD</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">TOSKA</p>
              <p className="text-xs text-gray-500">Distribution</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-white text-xs font-bold">TD</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {renderGroupedNav()}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary text-xs font-bold">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">{userRole}</p>
            </div>
          </div>
        )}

        {/* Bell — only for non-admin (admin has notifications in nav) */}
        {userRole !== 'ADMIN' && (
          <Link
            href={NOTIF_HREF[userRole] ?? '/admin/notifications'}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors w-full relative',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? 'Njoftimet' : undefined}
          >
            <span className="relative shrink-0">
              <Bell className={cn(collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            {!collapsed && <span>Njoftimet{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>}
          </Link>
        )}

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Dil' : undefined}
        >
          <LogOut className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {!collapsed && <span>Dil</span>}
        </button>
      </div>
    </aside>
  )
}
