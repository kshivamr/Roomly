import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bookingSchema } from '@/lib/validation/booking.schema'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const resourceId = searchParams.get('resource_id')

  let query = supabase
    .from('bookings')
    .select('id, resource_id, user_id, time_range, status, title, profiles(full_name)')
    .in('status', ['pending', 'approved'])
    .order('time_range', { ascending: true })

  if (resourceId) {
    query = query.eq('resource_id', resourceId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ bookings: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 }
    )
  }

  const { resource_id, title, start_time, end_time, repeat_weeks } = parsed.data

  // Look up whether this resource requires approval, to decide the
  // initial status. This is just for UX — it does NOT affect whether
  // overlap is prevented; the EXCLUDE constraint covers both
  // 'pending' and 'approved' statuses either way.
  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('requires_approval')
    .eq('id', resource_id)
    .single()

  if (resourceError || !resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  }

  const initialStatus = resource.requires_approval ? 'pending' : 'approved'

  // recurrence_group_id ties all rows in one "repeat weekly" series
  // together, but ONLY if repeat_weeks > 1. A one-off booking gets null,
  // matching the schema comment in 0001_init_schema.sql.
  const recurrenceGroupId = repeat_weeks > 1 ? crypto.randomUUID() : null

  const startDate = new Date(start_time)
  const endDate = new Date(end_time)

  const results: { week: number; status: 'created' | 'conflict' | 'error'; message?: string }[] = []
  const createdBookings: unknown[] = []

  // Materialize ONE REAL ROW PER WEEK — not a single abstract recurrence
  // rule. This is a deliberate design choice explained in the README:
  // each week is independently subject to the same EXCLUDE constraint,
  // so week 3 can succeed while week 4 fails (e.g. someone else already
  // holds that slot) without affecting the other weeks at all.
  for (let week = 0; week < repeat_weeks; week++) {
    const weekStart = new Date(startDate)
    weekStart.setDate(weekStart.getDate() + week * 7)
    const weekEnd = new Date(endDate)
    weekEnd.setDate(weekEnd.getDate() + week * 7)

    const timeRange = `[${weekStart.toISOString()},${weekEnd.toISOString()})`

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        resource_id,
        user_id: user.id,
        title,
        time_range: timeRange,
        status: initialStatus,
        recurrence_group_id: recurrenceGroupId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23P01') {
        results.push({ week: week + 1, status: 'conflict', message: 'Slot already taken' })
      } else {
        results.push({ week: week + 1, status: 'error', message: error.message })
      }
      continue
    }

    results.push({ week: week + 1, status: 'created' })
    createdBookings.push(data)
  }

  const conflictCount = results.filter((r) => r.status !== 'created').length

  // Single booking, single failure — keep the original simple error shape
  // so the non-recurring booking form doesn't need to change at all.
  if (repeat_weeks === 1 && results[0].status !== 'created') {
    return NextResponse.json(
      { error: results[0].message || 'Could not create booking.' },
      { status: results[0].status === 'conflict' ? 409 : 400 }
    )
  }

  return NextResponse.json(
    {
      bookings: createdBookings,
      summary: {
        requested: repeat_weeks,
        created: createdBookings.length,
        failed: conflictCount,
      },
      results,
    },
    { status: createdBookings.length > 0 ? 201 : 409 }
  )
}