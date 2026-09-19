import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import AppHeader from '@/components/AppHeader'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // This confirms RLS is letting you read your OWN profile row correctly
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-neutral-200 rounded-xl p-8">
        <AppHeader title="Dashboard" subtitle="You're logged in 🎉" />
        <div className="space-y-1 text-sm text-neutral-600 mb-6">
          <p><strong className="text-neutral-900">Email:</strong> {user.email}</p>
          <p><strong className="text-neutral-900">Name:</strong> {profile?.full_name ?? '—'}</p>
          <p><strong className="text-neutral-900">Role:</strong> {profile?.role ?? '—'}</p>
        </div>
        <p className="text-xs text-neutral-400 mb-6">
          If role shows &quot;member&quot; and you want to test admin features, go into
          the Supabase Table Editor → profiles → set your row&apos;s role to &quot;admin&quot;,
          then refresh this page.
        </p>
        <SignOutButton />
      </div>
    </div>
  )
}

