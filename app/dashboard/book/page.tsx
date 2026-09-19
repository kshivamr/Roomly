'use client'

import { useEffect, useState, useCallback } from 'react'

type Resource = {
  id: string
  name: string
  capacity: number | null
  requires_approval: boolean
}

type Booking = {
  id: string
  title: string
  time_range: string
  status: string
  profiles: { full_name: string } | null
}

export default function BookPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])

  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatWeeks, setRepeatWeeks] = useState(4)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_id: selectedResourceId,
        title,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        repeat_weeks: repeatEnabled ? repeatWeeks : 1,
      }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok && !json.summary) {
      // Single-booking failure (non-recurring), or total recurring failure
      setError(json.error || 'Something went wrong')
      return
    }

    if (json.summary) {
      // Recurring booking — some weeks may have succeeded, some may not
      const { created, failed, requested } = json.summary
      if (failed === 0) {
        setSuccess(`All ${created} weeks booked successfully.`)
      } else {
        setSuccess(
          `${created} of ${requested} weeks booked. ${failed} week(s) skipped — slot already taken.`
        )
      }
    } else {
      setSuccess(
        json.booking?.status === 'pending'
          ? 'Requested — waiting for admin approval.'
          : 'Booked!'
      )
    }

    setTitle('')
    setStartTime('')
    setEndTime('')
    setRepeatEnabled(false)
    setRepeatWeeks(4)
    loadBookings()
  }

  function formatRange(range: string) {
    // range looks like: ["2026-09-20 10:00:00+00","2026-09-20 11:00:00+00")
    const [start, end] = range
      .replace(/[[\]()]/g, '')
      .split(',')
      .map((s) => new Date(s.replace(/"/g, '')))
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', hour: 'numeric', minute: '2-digit' }
    return `${start.toLocaleDateString()} · ${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Book a resource</h1>
          <p className="text-sm text-neutral-500">Pick a resource, then choose a time.</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Resource</label>
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 bg-white"
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.requires_approval ? ' (needs approval)' : ''}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Client call"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Start</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">End</label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 bg-white"
                />
              </div>
            </div>

            <div className="border border-neutral-200 rounded-lg p-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={repeatEnabled}
                  onChange={(e) => setRepeatEnabled(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Repeat weekly
              </label>
              {repeatEnabled && (
                <div className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
                  <span>for</span>
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                    className="w-16 border border-neutral-300 rounded-lg px-2 py-1 text-sm text-neutral-900 bg-white"
                  />
                  <span>weeks (creates {repeatWeeks} separate bookings)</span>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !selectedResourceId}
              className="bg-neutral-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? 'Booking…' : 'Book slot'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-neutral-700 mb-2">
            Existing bookings for this resource
          </h2>
          <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {bookings.length > 0 ? (
              bookings.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{b.title}</p>
                    <p className="text-xs text-neutral-500">{formatRange(b.time_range)}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      b.status === 'approved'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-neutral-500">No bookings yet for this resource.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}