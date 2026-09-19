import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApprovalCard from '@/components/ApprovalCard'

export default async function ApprovalsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // UX redirect only — the actual security boundary is the RLS policy.
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: pending } = await supabase
    .from('bookings')
    .select('id, title, time_range, resources(name), profiles(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  function formatRange(range: string) {
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
          <h1 className="text-xl font-semibold text-neutral-900">Pending approvals</h1>
          <p className="text-sm text-neutral-500">
            Bookings waiting on your decision.
          </p>
        </div>

        <div className="space-y-3">
          {pending && pending.length > 0 ? (
            pending.map((b) => {
              // Supabase returns joined relations as arrays or objects
              // depending on the relationship shape — normalize defensively.
              const resource = Array.isArray(b.resources) ? b.resources[0] : b.resources
              const requester = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles

              return (
                <ApprovalCard
                  key={b.id}
                  bookingId={b.id}
                  title={b.title || 'Untitled'}
                  resourceName={resource?.name || 'Unknown resource'}
                  requesterName={requester?.full_name || 'Unknown user'}
                  timeRangeLabel={formatRange(b.time_range)}
                />
              )
            })
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-500">
              Nothing pending right now.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
