-- =========================================================
-- 0001_init_schema.sql
-- Core tables for Roomly: profiles, resources, bookings, notifications
-- =========================================================

-- Needed for the EXCLUDE constraint that prevents overlapping bookings
create extension if not exists btree_gist;

-- ---------------------------------------------------------
-- profiles: extends auth.users with a role
-- Supabase's auth.users table is managed by Supabase Auth itself,
-- so we keep app-specific fields (role, name) in a separate table
-- that references it 1:1.
-- ---------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'member' -- everyone starts as a member; promote to admin manually in DB for your demo
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- resources: the bookable "rooms"
-- ---------------------------------------------------------
create table public.resources (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text,
  capacity           int,
  requires_approval  boolean not null default false,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------
-- bookings: the core table. time_range is a tstzrange so we can
-- use a GiST EXCLUDE constraint to prevent overlaps at the DB level.
-- ---------------------------------------------------------
create table public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  resource_id           uuid not null references public.resources(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  time_range            tstzrange not null,
  status                text not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  title                 text,
  recurrence_group_id   uuid, -- null for one-off bookings; shared UUID for all rows in one recurring series
  created_at            timestamptz not null default now(),

  -- A booking can't end before it starts
  constraint valid_range check (lower(time_range) < upper(time_range)),

  -- THE key constraint: no two bookings for the same resource can have
  -- overlapping time ranges, AS LONG AS both are 'pending' or 'approved'.
  -- Rejected/cancelled bookings free up the slot (they're excluded here).
  constraint no_overlapping_bookings
    exclude using gist (
      resource_id with =,
      time_range with &&
    )
    where (status in ('pending', 'approved'))
);

create index bookings_resource_idx on public.bookings (resource_id);
create index bookings_user_idx on public.bookings (user_id);

-- ---------------------------------------------------------
-- notifications: feeds the real-time bell icon
-- ---------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('confirmed', 'rejected', 'conflict', 'pending')),
  message     text not null,
  booking_id  uuid references public.bookings(id) on delete cascade,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, is_read);

-- ---------------------------------------------------------
-- Auto-create a notification whenever a booking's status changes
-- (this is what Supabase Realtime will pick up and push to the bell)
-- ---------------------------------------------------------
create function public.handle_booking_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.notifications (user_id, type, message, booking_id)
    values (new.user_id, 'confirmed', 'Your booking "' || coalesce(new.title, 'Untitled') || '" was confirmed.', new.id);
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into public.notifications (user_id, type, message, booking_id)
    values (new.user_id, 'rejected', 'Your booking "' || coalesce(new.title, 'Untitled') || '" was rejected.', new.id);
  end if;
  return new;
end;
$$;

create trigger on_booking_status_change
  after update on public.bookings
  for each row execute function public.handle_booking_status_change();

-- Also notify on initial insert if it lands as 'pending' (needs approval)
create function public.handle_booking_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, type, message, booking_id)
    values (new.user_id, 'pending', 'Your booking "' || coalesce(new.title, 'Untitled') || '" is awaiting approval.', new.id);
  end if;
  return new;
end;
$$;

create trigger on_booking_created
  after insert on public.bookings
  for each row execute function public.handle_booking_created();
