'use client'

import { useEffect, useState, useCallback } from 'react'

type Resource = {
  id: string
  name: string
  requires_approval: boolean
}

type Booking = {
  id: string
  title: string
  time_range: string
  status: string
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 8am–6pm

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  return new Date(d.setDate(diff))
}

function parseRange(range: string) {
  const [start, end] = range
    .replace(/[[\]()]/g, '')
    .split(',')
    .map((s) => new Date(s.replace(/"/g, '')))
  return { start, end }
}

export default function AvailabilityGrid() {
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  useEffect(() => {
    fetch('/api/resources')
      .then((res) => res.json())
      .then((json) => {
        setResources(json.resources || [])
        if (json.resources?.[0]) setSelectedResourceId(json.resources[0].id)
      })
  }, [])

  const loadBookings = useCallback(() => {
    if (!selectedResourceId) return
    fetch(`/api/bookings?resource_id=${selectedResourceId}`)
      .then((res) => res.json())
      .then((json) => setBookings(json.bookings || []))
  }, [selectedResourceId])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function bookingsForCell(day: Date, hour: number) {
    return bookings.filter((b) => {
      const { start, end } = parseRange(b.time_range)
      const cellStart = new Date(day)
      cellStart.setHours(hour, 0, 0, 0)
      const cellEnd = new Date(day)
      cellEnd.setHours(hour + 1, 0, 0, 0)
      return start < cellEnd && end > cellStart
    })
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between flex-wrap gap-3">
        <select
          value={selectedResourceId}
          onChange={(e) => setSelectedResourceId(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm text-neutral-900 bg-white"
        >
          {resources.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d })}
            className="w-7 h-7 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-neutral-700 w-40 text-center">
            {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <button
            onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d })}
            className="w-7 h-7 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50"
          >
            ›
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 border-b border-neutral-100">
            <div className="p-2"></div>
            {days.map((d) => (
              <div key={d.toISOString()} className="p-2 text-center border-l border-neutral-100">
                <div className="text-xs text-neutral-400">
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div className="text-sm font-medium text-neutral-900">{d.getDate()}</div>
              </div>
            ))}
          </div>

          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-neutral-50 min-h-[44px]">
              <div className="p-2 text-xs text-neutral-400 text-right">
                {hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? 'am' : 'pm'}
              </div>
              {days.map((day) => {
                const cellBookings = bookingsForCell(day, hour)
                return (
                  <div key={day.toISOString() + hour} className="border-l border-neutral-50 p-0.5">
                    {cellBookings.map((b) => (
                      <div
                        key={b.id}
                        title={b.title}
                        className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate ${
                          b.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-neutral-100 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-green-100 border border-green-300" /> Approved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" /> Pending approval
        </span>
        <span>Blank cells are free</span>
      </div>
    </div>
  )
}