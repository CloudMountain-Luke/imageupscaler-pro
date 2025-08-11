-- =====================================================================
-- Fragrant Boat — Fixed Migration
-- Adds display_name, ensures FK without IF NOT EXISTS, and (re)creates
-- RLS policies that adapt to uuid vs text user IDs.
-- Safe to run multiple times.
-- =====================================================================

-- 1) Add the display_name column if missing
alter table public.user_profiles
  add column if not exists display_name text;

-- 2) Ensure RLS is enabled
alter table public.user_profiles enable row level security;

-- 3) Drop existing policies (idempotent) so we can recreate cleanly
drop policy if exists user_profiles_select_own on public.user_profiles;
drop policy if exists user_profiles_upsert_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;

-- 4) Recreate policies depending on the id column type (uuid vs text)
--    Postgres requires dynamic SQL inside a DO block
DO $$
DECLARE
  id_is_uuid boolean;
BEGIN
  SELECT (c.data_type = 'uuid')
  INTO id_is_uuid
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name   = 'user_profiles'
    AND c.column_name  = 'id';

  IF id_is_uuid THEN
    -- uuid policies
    EXECUTE 'create policy user_profiles_select_own on public.user_profiles
              for select using (auth.uid() = id)';
    EXECUTE 'create policy user_profiles_upsert_own on public.user_profiles
              for insert with check (auth.uid() = id)';
    EXECUTE 'create policy user_profiles_update_own on public.user_profiles
              for update using (auth.uid() = id)';
  ELSE
    -- text policies (cast auth.uid() to text)
    EXECUTE 'create policy user_profiles_select_own on public.user_profiles
              for select using ((auth.uid())::text = id)';
    EXECUTE 'create policy user_profiles_upsert_own on public.user_profiles
              for insert with check ((auth.uid())::text = id)';
    EXECUTE 'create policy user_profiles_update_own on public.user_profiles
              for update using ((auth.uid())::text = id)';
  END IF;
END$$;

-- 5) Ensure FK user_profiles.subscription_tier_id -> subscription_tiers(id)
--    Postgres does not support "ADD CONSTRAINT IF NOT EXISTS", so we guard via DO
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'user_profiles_subscription_tier_fk'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_subscription_tier_fk
      FOREIGN KEY (subscription_tier_id)
      REFERENCES public.subscription_tiers(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Optional: helpful index on the FK
create index if not exists idx_user_profiles_subscription_tier_id
  on public.user_profiles (subscription_tier_id);

-- Optional: backfill display_name for nulls (uses email fallback)
-- update public.user_profiles
--   set display_name = coalesce(display_name, email, 'User')
-- where display_name is null;

-- =====================================================================
-- NOTES
-- * If you later migrate user_profiles.id from text -> uuid, just re-run
--   this file; the DO block will replace policies with the uuid-safe ones.
-- * Ensure subscription_tiers.id matches the type of subscription_tier_id.
--   If they differ, migrate or cast before adding the FK.
-- =====================================================================