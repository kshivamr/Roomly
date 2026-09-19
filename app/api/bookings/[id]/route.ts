import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const statusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // No manual "is this user an admin" check here for approve/reject.
  // The RLS policy "bookings_admin_update_any" is what actually allows
  // this update — a member trying to approve their own booking gets
  // blocked by Postgres itself, not by this code.
  //
  // (Members ARE allowed to set their OWN booking to 'cancelled' via the
  // "bookings_cancel_own" policy, which is why 'cancelled' is included
  // in the allowed statuses above.)
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // A member trying to approve/reject lands here — RLS silently
    // returns 0 rows updated, which surfaces as "no rows" from .single()
    return NextResponse.json(
      { error: 'Not permitted, or booking not found.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ booking: data })
}