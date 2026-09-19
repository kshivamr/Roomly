-- =========================================================
-- 0002_rls_policies.sql
-- Row-Level Security: enforces admin/member permissions at the DB layer.
-- This is what stops a member from approving their own booking even if
-- they call the API directly and bypass the UI.
-- =========================================================

-- Helper function: is the currently logged-in user an admin?
-- SECURITY DEFINER + search_path pinned so it can't be hijacked.
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Enable RLS on every table (nothing is accessible until a policy allows it)
alter table public.profiles enable row level security;
alter table public.resources enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
-- Anyone logged in can see basic profile info (needed to show names on bookings)
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only update their own profile, and can NEVER change their own role
create policy "profiles_update_own_non_role"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Only admins can change anyone's role
create policy "profiles_admin_manage_roles"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------
-- resources
-- ---------------------------------------------------------
-- Everyone logged in can view resources
create policy "resources_select_all_authenticated"
  on public.resources for select
  to authenticated
  using (true);

-- Only admins can create/edit/delete resources
create policy "resources_admin_insert"
  on public.resources for insert
  to authenticated
  with check (public.is_admin());

create policy "resources_admin_update"
  on public.resources for update
  to authenticated
  using (public.is_admin());

create policy "resources_admin_delete"
  on public.resources for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------
-- bookings
-- ---------------------------------------------------------
-- Members see their own bookings; admins see everyone's
create policy "bookings_select_own_or_admin"
  on public.bookings for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Any authenticated user can create a booking FOR THEMSELVES
-- (the EXCLUDE constraint from migration 0001 is what actually
-- prevents overlaps — this policy just checks ownership)
create policy "bookings_insert_own"
  on public.bookings for insert
  to authenticated
  with check (user_id = auth.uid());

-- Members can cancel their OWN pending/approved bookings.
-- They CANNOT set status to 'approved' or 'rejected' — that's admin-only,
-- enforced below by a separate, more permissive admin policy.
create policy "bookings_cancel_own"
  on public.bookings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'cancelled');

-- Only admins can approve/reject bookings (any status transition)
create policy "bookings_admin_update_any"
  on public.bookings for update
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------
-- notifications
-- ---------------------------------------------------------
-- Users can only ever see their own notifications
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Users can mark their own notifications as read
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Note: inserts into notifications happen only via the trigger functions
-- in 0001 (which run as SECURITY DEFINER), so no direct insert policy
-- is needed for regular users — this prevents anyone from faking
-- notifications for other users.
