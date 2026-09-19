# Roomly — Team Resource / Meeting Room Booking System

A booking tool for shared resources (meeting rooms, equipment) with conflict-free scheduling, an admin approval workflow, and real-time in-app notifications.

**Live URL:** https://roomly-amber.vercel.app
**GitHub repo:** https://github.com/kshivamr/Roomly

---

## Tech stack

| Piece           | Choice                                                               |
| --------------- | -------------------------------------------------------------------- |
| Framework       | Next.js 16.2 (App Router), TypeScript                                |
| Styling         | Tailwind CSS v4                                                      |
| Validation      | Zod — every API route validates input before it touches the database |
| Database + Auth | Supabase (Postgres 17)                                               |
| Real-time       | Supabase Realtime (WebSocket subscriptions, not polling)             |
| Deployment      | Vercel                                                               |

No substitutions from the suggested stack were needed.

---

## How to run it locally

```bash
git clone https://github.com/kshivamr/Roomly.git
cd roomly
npm install
```

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Push the schema to your own Supabase project:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Then:

```bash
npm run dev
```

Note: this project has "Confirm email" disabled in Supabase Auth settings, so sign-up logs you in immediately — a deliberate choice for a prototype/demo, not something I'd ship for a real product.

---

## How conflict detection works (the core requirement)

Every booking is stored with a `time_range` column of type `tstzrange` (a Postgres range type). The `bookings` table has this constraint:

```sql
constraint no_overlapping_bookings
  exclude using gist (
    resource_id with =,
    time_range with &&
  )
  where (status in ('pending', 'approved'))
```

This is a **Postgres `EXCLUDE` constraint** using the `btree_gist` extension. In plain terms: for any given resource, no two rows can have overlapping time ranges as long as both are `pending` or `approved`. Rejected/cancelled bookings are excluded from this check, so a freed-up slot can be rebooked.

**What happens under concurrency, specifically:**

1. The API route (`app/api/bookings/route.ts`) does **not** manually check for overlaps in application code. It simply attempts an `INSERT`.
2. If two requests arrive for the same or overlapping slot at nearly the same instant, Postgres serializes the two inserts at the database level. The first one to commit succeeds. The second one is rejected by the `EXCLUDE` constraint with error code `23P01` (`exclusion_violation`).
3. The API route catches that specific error code and returns a clean `409 Conflict` response: _"That slot was just taken. Please pick a different time."_ — instead of a raw database error.

This is a genuine database-enforced guarantee, not a "check then insert" race condition in app code. It was manually tested by submitting two overlapping booking requests back to back on the same resource — the second was reliably rejected every time, and the `bookings` table never contained two overlapping rows for the same resource.

---

## How recurring bookings are stored

Recurring bookings are **materialized as individual real rows**, not stored as a single abstract recurrence rule (e.g. an RRULE string).

When a user selects "Repeat weekly for N weeks," the API (`app/api/bookings/route.ts`) loops N times, creating **one full booking row per week**, each with its own `time_range`, computed by adding `7 * week_number` days to the original start/end times. All rows in one series share a `recurrence_group_id` (a UUID) so they can be identified as belonging to the same series if needed later, but each row is otherwise a completely independent booking.

**Why this approach, not a recurrence rule:**

- Each week's booking is independently subject to the same `EXCLUDE` constraint. If week 3 of a 6-week series is already taken by someone else, weeks 1, 2, 4, 5, and 6 still succeed — only week 3 is rejected. A single abstract rule would make this kind of partial success much harder to represent and query.
- Approving/rejecting/cancelling one occurrence of a recurring series doesn't require any special-case logic — it's just a normal `UPDATE` on a normal row, using the same approval workflow as any other booking.
- The trade-off: this is less storage-efficient than a rule-based approach for very long series, and there's no current UI for "cancel entire series at once" — a real limitation, noted below.

---

## Approval workflow

Each resource has a `requires_approval` boolean set by an admin. When a booking is created:

- If `requires_approval` is false → the booking is inserted with `status = 'approved'` immediately.
- If true → it's inserted as `status = 'pending'`.

Admins see all pending bookings at `/admin/approvals` and can approve or reject them. Status is an explicit enum column (`pending | approved | rejected | cancelled`) — not inferred from nullable fields.

**Enforcement:** a member cannot approve or reject any booking, including their own, even by calling the API directly. This is enforced by a Postgres RLS policy (`bookings_admin_update_any`) that only allows the `UPDATE` if the requesting user's `profiles.role = 'admin'`. This was tested by attempting to hit the approval endpoint as a logged-in member account — the request is rejected by the database, not just hidden in the UI.

---

## Real-time notifications

Whenever a booking's status changes (created as pending, approved, or rejected), a Postgres trigger (see `supabase/migrations/0001_init_schema.sql`) automatically inserts a row into the `notifications` table.

The frontend (`components/NotificationBell.tsx`) subscribes to this table via **Supabase Realtime** — a genuine WebSocket subscription (`supabase.channel(...).on('postgres_changes', ...)`), filtered to the logged-in user's own notifications. New notifications appear in the bell instantly, with no polling loop and no page refresh required. This was tested with two browser sessions open side by side: approving a booking as an admin in one window caused the notification to appear live in the other window within roughly a second.

---

## Row-Level Security

Every table has RLS enabled. Key policies:

- Members can only see and cancel their own bookings; admins can see and manage all bookings.
- Only admins can create/edit resources.
- Only admins can approve/reject bookings.
- A member cannot promote themselves to admin (the `profiles` update policy blocks changing your own `role`).

All of this is enforced at the database layer — the frontend UI hides buttons a user shouldn't see, but the actual security boundary is Postgres, verified by directly hitting API routes as a non-admin account.

---

## Out of scope (as specified in the brief)

- Google Calendar / Outlook sync or OAuth
- Email or SMS reminders
- Payment for resource usage
- Multi-organization / multi-tenant support

---

## What I'd build next with another week

- **`.ics` calendar export** for confirmed bookings, using the `ics` npm package — deferred to prioritize getting the core concurrency and approval logic fully correct first.
- **Cancel an entire recurring series at once**, rather than only individual occurrences — currently each week must be cancelled separately.
- **A proper calendar/grid view** of a resource's weekly availability, rather than a flat list of existing bookings — would make it much easier to visually spot free slots before booking.
- **Email confirmation re-enabled** with a proper verification flow, since it's currently disabled for ease of local testing.
- **Automated tests** for the concurrency scenario (currently verified manually) — e.g. firing simultaneous requests programmatically to more rigorously confirm the `EXCLUDE` constraint holds under real load, not just two manual browser submissions.
