import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resourceSchema } from '@/lib/validation/resource.schema'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ resources: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  // Validate the shape/types BEFORE it touches the database.
  // Never trust client input.
  const parsed = resourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 }
    )
  }

  // NOTE: we don't check "is this user an admin" here in app code.
  // The RLS policy "resources_admin_insert" on the database enforces that —
  // if a non-admin calls this route directly, Postgres rejects the insert
  // and this returns an error, not a fake success.
  const { data, error } = await supabase
    .from('resources')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      capacity: parsed.data.capacity ?? null,
      requires_approval: parsed.data.requires_approval,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    // A non-admin hitting this will land here with a permissions/RLS error —
    // that's the database doing its job, not a bug.
    return NextResponse.json({ error: error.message }, { status: 403 })
  }

  return NextResponse.json({ resource: data }, { status: 201 })
}