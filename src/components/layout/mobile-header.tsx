'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Menu, X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './sidebar'

interface MobileHeaderProps {
  userRole: string
  userName: string
}

export function MobileHeader({ userRole, userName }: MobileHeaderProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const items = NAV_ITEMS.filter(item => item.roles.includes(userRole))

  const close = () => setOpen(false)

  return (
    <>
      {/* Top header bar — mobile only */}
      <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-gray-200 shrink-0 z-30">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-11 h-11 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="Hap menunë"
        >
          <Menu className="h-6 w-6 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-white text-[11px] font-bold">TD</span>
          </div>
          <span className="font-bold text-gray-900 text-sm tracking-tight">TOSKA DISTRIBUTION</span>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 lg:hidden transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={close}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl flex flex-col lg:hidden transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Menuja kryesore"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">TD</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">TOSKA</p>
              <p className="text-xs text-gray-500 mt-0.5">Distribution</p>
            </div>
          </div>
          <button
            onClick={close}
            className="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Mbyll menunë"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {items.map(item => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href + '/'))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  'flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-gray-100 p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary text-sm font-bold">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
              <p className="text-xs text-gray-500">{userRole}</p>
            </div>
          </div>
          <button
            onClick={() => { close(); signOut({ callbackUrl: '/login' }) }}
            className="flex items-center gap-3 px-3 rounded-xl text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full min-h-[44px]"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Dil nga llogaria</span>
          </button>
        </div>
      </div>
    </>
  )
}
