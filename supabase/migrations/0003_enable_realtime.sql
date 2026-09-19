-- =========================================================
-- 0003_enable_realtime.sql
-- Supabase Realtime only streams changes for tables explicitly
-- added to this publication. Without this, the notification bell
-- will never receive live updates — it'll just sit empty.
-- =========================================================
alter publication supabase_realtime
add table public.notifications;