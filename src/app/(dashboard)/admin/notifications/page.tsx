'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, CheckCheck, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  data?: Record<string, unknown>
}

const TYPE_ICON: Record<string, string> = {
  ORDER_PENDING: '📋', LOW_STOCK: '⚠️', OVERDUE_DEBT: '💰', RETURN_PENDING: '↩️',
  DELIVERY_READY: '🚚', SYSTEM_ERROR: '🔴', ORDER_APPROVED: '✅', PAYMENT_RECEIVED: '💵',
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/notifications')
    const data = await res.json()
    setNotifications(data.notifications ?? [])
    setUnread(data.unreadCount ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markRead = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    setMarking(true)
    try {
      const res = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnread(0)
        toast.success('Të gjitha u shënuan si të lexuara')
      }
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Njoftimet</h1>
          {unread > 0 && <Badge variant="destructive">{unread} të palexuara</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchNotifications} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} loading={marking} className="gap-1.5">
              <CheckCheck className="h-4 w-4" />Shëno Të Gjitha
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse bg-gray-50" />)}</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <BellOff className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk ka njoftime</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`px-4 py-4 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50/40 border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-primary transition-colors"
                      title="Shëno si të lexuar"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
