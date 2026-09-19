'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApprovalCard({
  bookingId,
  title,
  resourceName,
  requesterName,
  timeRangeLabel,
}: {
  bookingId: string
  title: string
  resourceName: string
  requesterName: string
  timeRangeLabel: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDecision(status: 'approved' | 'rejected') {
    setLoading(status)
    setError(null)

    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    if (!res.ok) {
      const json = await res.json()
      setError(json.error || 'Something went wrong')
      setLoading(null)
      return
    }

    router.refresh() // re-fetches the pending list, this card disappears
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-neutral-900">
          {title} — {resourceName}
        </p>
        <p className="text-xs text-neutral-500">
          {requesterName} · {timeRangeLabel}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => handleDecision('approved')}
          disabled={loading !== null}
          className="bg-neutral-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading === 'approved' ? '…' : 'Approve'}
        </button>
        <button
          onClick={() => handleDecision('rejected')}
          disabled={loading !== null}
          className="bg-red-50 text-red-700 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
        >
          {loading === 'rejected' ? '…' : 'Reject'}
        </button>
      </div>
    </div>
  )
}
