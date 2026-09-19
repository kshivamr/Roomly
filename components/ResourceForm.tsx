'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResourceForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [capacity, setCapacity] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        capacity: capacity ? Number(capacity) : null,
        requires_approval: requiresApproval,
      }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error || 'Something went wrong')
      return
    }

    setName('')
    setDescription('')
    setCapacity('')
    setRequiresApproval(false)
    router.refresh() // re-fetches the resource list on the page
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-neutral-900">Add a resource</h2>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Conference Room B"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="2nd floor, near the kitchen"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Capacity (optional)
        </label>
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="8"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={requiresApproval}
          onChange={(e) => setRequiresApproval(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Bookings need admin approval
      </label>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-neutral-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
      >
        {loading ? 'Adding…' : 'Add resource'}
      </button>
    </form>
  )
}
