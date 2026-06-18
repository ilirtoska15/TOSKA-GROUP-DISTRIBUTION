'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Search, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TopbarProps {
  title?: string
  onMobileMenuToggle?: () => void
}

export function Topbar({ title, onMobileMenuToggle }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <button
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {title && !searchOpen && (
        <h1 className="font-semibold text-gray-900 text-lg hidden sm:block">{title}</h1>
      )}

      <div className="flex-1" />

      {/* Search */}
      {searchOpen ? (
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
          <Input
            autoFocus
            placeholder="Kërko klient, produkt, porosi..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setSearchOpen(false); setQuery('') }}>
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSearchOpen(true)}
          className="text-gray-500 hover:text-gray-700"
        >
          <Search className="h-5 w-5" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        className="text-gray-500 hover:text-gray-700 relative"
        onClick={() => router.push('/admin/notifications')}
      >
        <Bell className="h-5 w-5" />
        {/* Notification dot */}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </Button>
    </header>
  )
}
