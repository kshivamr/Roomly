'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  type: 'confirmed' | 'rejected' | 'conflict' | 'pending'
  message: string
  is_read: boolean
  created_at: string
}

export default function NotificationBell() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  useEffect(() => {
    let userId: string | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id

      // Initial load — RLS ensures this only ever returns YOUR notifications
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      setNotifications(data || [])

      // Real-time subscription: pushes new rows the instant the DB trigger
      // inserts one (e.g. when an admin approves/rejects your booking).
      // This is a genuine WebSocket subscription, not a polling loop.
      const channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev])
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    const cleanupPromise = init()

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  function typeColor(type: Notification['type']) {
    if (type === 'confirmed') return 'bg-green-500'
    if (type === 'rejected' || type === 'conflict') return 'bg-red-500'
    return 'bg-amber-500'
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => {
          setOpen((o) => !o)
          if (!open) markAllRead()
        }}
        className="relative w-9 h-9 rounded-lg border border-neutral-300 bg-white flex items-center justify-center"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-20">
          <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-sm text-neutral-900">
            Notifications
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-neutral-100 flex gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${typeColor(n.type)}`} />
                  <div>
                    <p className="text-sm text-neutral-900">{n.message}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-neutral-400 text-center">
                No notifications yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
