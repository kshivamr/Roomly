import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ResourceForm from '@/components/ResourceForm'

export default async function AdminResourcesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // App-level check for a clean redirect/UX — the REAL enforcement
  // is the RLS policy on the resources table (see 0002_rls_policies.sql).
  // Even if someone bypasses this check, the database blocks the insert.
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Resources</h1>
          <p className="text-sm text-neutral-500">
            Rooms and equipment members can book.
          </p>
        </div>

        <ResourceForm />

        <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {resources && resources.length > 0 ? (
            resources.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{r.name}</p>
                  <p className="text-xs text-neutral-500">
                    {r.description || 'No description'}
                    {r.capacity ? ` · Capacity ${r.capacity}` : ''}
                  </p>
                </div>
                {r.requires_approval && (
                  <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                    Needs approval
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-neutral-500">No resources yet — add one above.</p>
          )}
        </div>
      </div>
    </div>
  )
}
