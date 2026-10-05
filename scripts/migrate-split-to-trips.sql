-- ============================================
-- Migrate SmartPocket "split groups" to Trips ("Viajes")
-- Run this ONCE in the Supabase SQL Editor (it is safe to re-run: every step
-- checks the current state first).
--
-- Requires: scripts/create-smartpocket-tables.sql (+ fix-smartpocket-rls.sql)
-- already applied, and the `transactions` table from create-tables.sql.
--
-- No data is lost: the four split tables are RENAMED. Existing groups become
-- trips without dates/destination/budget.
--
--   split_groups          -> trips
--   split_group_members   -> trip_members        (group_id -> trip_id)
--   split_expenses        -> trip_expenses       (group_id -> trip_id)
--   split_expense_shares  -> trip_expense_shares
-- ============================================

-- --------------------------------------------
-- 1. Rename tables
-- --------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.split_groups') IS NOT NULL AND to_regclass('public.trips') IS NULL THEN
    ALTER TABLE public.split_groups RENAME TO trips;
  END IF;
  IF to_regclass('public.split_group_members') IS NOT NULL AND to_regclass('public.trip_members') IS NULL THEN
    ALTER TABLE public.split_group_members RENAME TO trip_members;
  END IF;
  IF to_regclass('public.split_expenses') IS NOT NULL AND to_regclass('public.trip_expenses') IS NULL THEN
    ALTER TABLE public.split_expenses RENAME TO trip_expenses;
  END IF;
  IF to_regclass('public.split_expense_shares') IS NOT NULL AND to_regclass('public.trip_expense_shares') IS NULL THEN
    ALTER TABLE public.split_expense_shares RENAME TO trip_expense_shares;
  END IF;
END $$;

-- --------------------------------------------
-- 2. Rename group_id columns -> trip_id
-- --------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'trip_members' AND column_name = 'group_id') THEN
    ALTER TABLE public.trip_members RENAME COLUMN group_id TO trip_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'trip_expenses' AND column_name = 'group_id') THEN
    ALTER TABLE public.trip_expenses RENAME COLUMN group_id TO trip_id;
  END IF;
END $$;

-- --------------------------------------------
-- 3. Rename constraints (Postgres default names), indexes and triggers
--    Renaming a PK/UNIQUE constraint also renames its backing index.
-- --------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('trips',               'split_groups_pkey',                              'trips_pkey'),
      ('trips',               'split_groups_created_by_fkey',                   'trips_created_by_fkey'),
      ('trip_members',        'split_group_members_pkey',                       'trip_members_pkey'),
      ('trip_members',        'split_group_members_group_id_fkey',              'trip_members_trip_id_fkey'),
      ('trip_members',        'split_group_members_user_id_fkey',               'trip_members_user_id_fkey'),
      ('trip_members',        'split_group_members_invite_token_key',           'trip_members_invite_token_key'),
      ('trip_members',        'split_group_members_group_id_email_key',         'trip_members_trip_id_email_key'),
      ('trip_members',        'split_group_members_invite_status_check',        'trip_members_invite_status_check'),
      ('trip_expenses',       'split_expenses_pkey',                            'trip_expenses_pkey'),
      ('trip_expenses',       'split_expenses_group_id_fkey',                   'trip_expenses_trip_id_fkey'),
      ('trip_expenses',       'split_expenses_paid_by_member_id_fkey',          'trip_expenses_paid_by_member_id_fkey'),
      ('trip_expenses',       'split_expenses_split_method_check',              'trip_expenses_split_method_check'),
      ('trip_expense_shares', 'split_expense_shares_pkey',                      'trip_expense_shares_pkey'),
      ('trip_expense_shares', 'split_expense_shares_expense_id_fkey',           'trip_expense_shares_expense_id_fkey'),
      ('trip_expense_shares', 'split_expense_shares_member_id_fkey',            'trip_expense_shares_member_id_fkey'),
      ('trip_expense_shares', 'split_expense_shares_expense_id_member_id_key',  'trip_expense_shares_expense_id_member_id_key')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND cl.relname = r.tbl AND c.conname = r.old_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', r.tbl, r.old_name, r.new_name);
    END IF;
  END LOOP;

  -- Triggers
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_split_groups_updated_at'
             AND tgrelid = 'public.trips'::regclass) THEN
    ALTER TRIGGER update_split_groups_updated_at ON public.trips RENAME TO update_trips_updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_split_expenses_updated_at'
             AND tgrelid = 'public.trip_expenses'::regclass) THEN
    ALTER TRIGGER update_split_expenses_updated_at ON public.trip_expenses RENAME TO update_trip_expenses_updated_at;
  END IF;
END $$;

ALTER INDEX IF EXISTS idx_split_group_members_group_id     RENAME TO idx_trip_members_trip_id;
ALTER INDEX IF EXISTS idx_split_group_members_user_id      RENAME TO idx_trip_members_user_id;
ALTER INDEX IF EXISTS idx_split_group_members_invite_token RENAME TO idx_trip_members_invite_token;
ALTER INDEX IF EXISTS idx_split_expenses_group_id          RENAME TO idx_trip_expenses_trip_id;
ALTER INDEX IF EXISTS idx_split_expense_shares_expense_id  RENAME TO idx_trip_expense_shares_expense_id;
ALTER INDEX IF EXISTS idx_split_expense_shares_member_id   RENAME TO idx_trip_expense_shares_member_id;

-- --------------------------------------------
-- 4. New columns
-- --------------------------------------------
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2);

-- Personal transaction created for the payer when the payer is the user who
-- recorded the expense (see lib/trips-api.ts).
ALTER TABLE public.trip_expenses
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trip_expenses_transaction_id ON public.trip_expenses(transaction_id);

-- --------------------------------------------
-- 5. Drop every old policy on the four tables, then the old helpers
-- --------------------------------------------
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('trips', 'trip_members', 'trip_expenses', 'trip_expense_shares')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.is_group_member(UUID);
DROP FUNCTION IF EXISTS public.is_group_admin(UUID);

-- --------------------------------------------
-- 6. SECURITY DEFINER helpers (bypass RLS to avoid policy recursion)
-- --------------------------------------------

-- Accepted members of the trip, or its creator.
CREATE OR REPLACE FUNCTION public.is_trip_member(tid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = tid AND user_id = auth.uid() AND invite_status = 'accepted'
  ) OR EXISTS (
    SELECT 1 FROM trips WHERE id = tid AND created_by = auth.uid()
  );
$$;

-- Accepted admin members of the trip, or its creator.
CREATE OR REPLACE FUNCTION public.is_trip_admin(tid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = tid AND user_id = auth.uid() AND invite_status = 'accepted' AND is_admin = TRUE
  ) OR EXISTS (
    SELECT 1 FROM trips WHERE id = tid AND created_by = auth.uid()
  );
$$;

-- --------------------------------------------
-- 7. RLS policies
-- --------------------------------------------
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_expense_shares ENABLE ROW LEVEL SECURITY;

-- Trips
CREATE POLICY "Members can view their trips"
  ON public.trips FOR SELECT
  USING (created_by = auth.uid() OR is_trip_member(id));

CREATE POLICY "Users can create trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Trip admins can update trips"
  ON public.trips FOR UPDATE
  USING (is_trip_admin(id));

CREATE POLICY "Trip creators can delete trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = created_by);

-- Trip members
-- A pending invitee can read their own row (to see/answer the invitation).
CREATE POLICY "Members can view trip members"
  ON public.trip_members FOR SELECT
  USING (is_trip_member(trip_id) OR user_id = auth.uid());

-- Client-side inserts are limited to:
--   a) guests without an account (no user_id, no email), added by any
--      accepted member, always accepted and never admin;
--   b) the trip creator adding their own admin row when creating the trip.
-- Registered users are invited from the server (service role) so the invite
-- can be validated and a notification created.
CREATE POLICY "Members can add guests and creators themselves"
  ON public.trip_members FOR INSERT
  WITH CHECK (
    (
      user_id IS NULL
      AND email IS NULL
      AND invite_status = 'accepted'
      AND is_admin = FALSE
      AND is_trip_member(trip_id)
    )
    OR (
      user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_members.trip_id AND t.created_by = auth.uid())
    )
  );

-- Only admins can update member rows from the client (e.g. rename a guest).
-- Accepting/declining an invitation goes through the server API, so an
-- invitee can never promote themselves.
CREATE POLICY "Trip admins can update members"
  ON public.trip_members FOR UPDATE
  USING (is_trip_admin(trip_id));

CREATE POLICY "Trip admins can delete members"
  ON public.trip_members FOR DELETE
  USING (is_trip_admin(trip_id));

-- Trip expenses
CREATE POLICY "Members can view trip expenses"
  ON public.trip_expenses FOR SELECT
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can insert trip expenses"
  ON public.trip_expenses FOR INSERT
  WITH CHECK (
    is_trip_member(trip_id)
    AND EXISTS (
      SELECT 1 FROM trip_members m
      WHERE m.id = paid_by_member_id AND m.trip_id = trip_expenses.trip_id
    )
  );

CREATE POLICY "Members can update trip expenses"
  ON public.trip_expenses FOR UPDATE
  USING (is_trip_member(trip_id))
  WITH CHECK (
    is_trip_member(trip_id)
    AND EXISTS (
      SELECT 1 FROM trip_members m
      WHERE m.id = paid_by_member_id AND m.trip_id = trip_expenses.trip_id
    )
  );

CREATE POLICY "Members can delete trip expenses"
  ON public.trip_expenses FOR DELETE
  USING (is_trip_member(trip_id));

-- Trip expense shares (access through the expense's trip)
CREATE POLICY "Members can view expense shares"
  ON public.trip_expense_shares FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trip_expenses e
    WHERE e.id = trip_expense_shares.expense_id AND is_trip_member(e.trip_id)
  ));

CREATE POLICY "Members can insert expense shares"
  ON public.trip_expense_shares FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trip_expenses e
    WHERE e.id = trip_expense_shares.expense_id AND is_trip_member(e.trip_id)
  ));

CREATE POLICY "Members can update expense shares"
  ON public.trip_expense_shares FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM trip_expenses e
    WHERE e.id = trip_expense_shares.expense_id AND is_trip_member(e.trip_id)
  ));

-- New: editing an expense replaces its shares.
CREATE POLICY "Members can delete expense shares"
  ON public.trip_expense_shares FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM trip_expenses e
    WHERE e.id = trip_expense_shares.expense_id AND is_trip_member(e.trip_id)
  ));
