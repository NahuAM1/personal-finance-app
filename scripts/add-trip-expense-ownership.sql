-- Trip expense ownership (idempotent, single transaction).
--
-- Before: any accepted trip member could edit/delete any trip expense and its
-- shares (including marking them settled).
-- After:
--   * trip_expenses.created_by records who recorded the expense.
--   * Only the trip owner (trips.created_by) or the expense creator can edit or
--     delete an expense and insert/delete its shares. Any member can still
--     create expenses (as themselves).
--   * Settling a debt (Saldos tab) stays allowed for the trip owner, the expense
--     creator, the debtor (share member) and the creditor (expense payer). From
--     the client, shares can only change is_settled / settled_at.
--
-- Requires: scripts/migrate-split-to-trips.sql and scripts/add-multi-currency.sql.
-- Supabase run order:
--   a) Run this script ONCE in the Supabase SQL Editor BEFORE deploying the app code.
--   b) Re-run it to confirm it is a no-op.
BEGIN;

-- 1. created_by column (nullable: the creator account may be deleted later)
ALTER TABLE public.trip_expenses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trip_expenses ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_trip_expenses_created_by ON public.trip_expenses(created_by);

-- 2. Backfill: the payer's account when the payer has one, otherwise the trip owner.
--    The updated_at trigger is paused so the backfill does not touch updated_at.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trip_expenses_updated_at'
             AND tgrelid = 'public.trip_expenses'::regclass) THEN
    ALTER TABLE public.trip_expenses DISABLE TRIGGER update_trip_expenses_updated_at;
  END IF;
END $$;

UPDATE public.trip_expenses e
SET created_by = COALESCE(m.user_id, t.created_by)
FROM public.trips t, public.trip_members m
WHERE t.id = e.trip_id
  AND m.id = e.paid_by_member_id
  AND e.created_by IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trip_expenses_updated_at'
             AND tgrelid = 'public.trip_expenses'::regclass) THEN
    ALTER TABLE public.trip_expenses ENABLE TRIGGER update_trip_expenses_updated_at;
  END IF;
END $$;

-- 3. SECURITY DEFINER helpers (bypass RLS to avoid policy recursion)

-- The current user created the trip.
CREATE OR REPLACE FUNCTION public.is_trip_owner(tid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips WHERE id = tid AND created_by = auth.uid()
  );
$$;

-- The current user owns the expense's trip or created the expense.
CREATE OR REPLACE FUNCTION public.can_manage_trip_expense(eid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_expenses e
    JOIN trips t ON t.id = e.trip_id
    WHERE e.id = eid
      AND (e.created_by = auth.uid() OR t.created_by = auth.uid())
  );
$$;

-- The current user can mark a share as settled: they manage the expense, or
-- they are the accepted member who owes the share (mid) or who paid the expense.
CREATE OR REPLACE FUNCTION public.can_settle_trip_expense_share(eid UUID, mid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.can_manage_trip_expense(eid) OR EXISTS (
    SELECT 1 FROM trip_expenses e
    JOIN trip_members m ON m.trip_id = e.trip_id
    WHERE e.id = eid
      AND m.user_id = auth.uid()
      AND m.invite_status = 'accepted'
      AND (m.id = mid OR m.id = e.paid_by_member_id)
  );
$$;

-- 4. trip_expenses policies (SELECT stays "Members can view trip expenses")
DROP POLICY IF EXISTS "Members can insert trip expenses" ON public.trip_expenses;
DROP POLICY IF EXISTS "Members can update trip expenses" ON public.trip_expenses;
DROP POLICY IF EXISTS "Members can delete trip expenses" ON public.trip_expenses;
DROP POLICY IF EXISTS "Members can insert own trip expenses" ON public.trip_expenses;
DROP POLICY IF EXISTS "Owners and creators can update trip expenses" ON public.trip_expenses;
DROP POLICY IF EXISTS "Owners and creators can delete trip expenses" ON public.trip_expenses;

CREATE POLICY "Members can insert own trip expenses"
  ON public.trip_expenses FOR INSERT
  WITH CHECK (
    created_by = (select auth.uid())
    AND is_trip_member(trip_id)
    AND EXISTS (
      SELECT 1 FROM trip_members m
      WHERE m.id = paid_by_member_id AND m.trip_id = trip_expenses.trip_id
    )
  );

CREATE POLICY "Owners and creators can update trip expenses"
  ON public.trip_expenses FOR UPDATE
  USING (created_by = (select auth.uid()) OR is_trip_owner(trip_id))
  WITH CHECK (
    (created_by = (select auth.uid()) OR is_trip_owner(trip_id))
    AND is_trip_member(trip_id)
    AND EXISTS (
      SELECT 1 FROM trip_members m
      WHERE m.id = paid_by_member_id AND m.trip_id = trip_expenses.trip_id
    )
  );

CREATE POLICY "Owners and creators can delete trip expenses"
  ON public.trip_expenses FOR DELETE
  USING (created_by = (select auth.uid()) OR is_trip_owner(trip_id));

-- 5. trip_expense_shares policies (SELECT stays "Members can view expense shares")
DROP POLICY IF EXISTS "Members can insert expense shares" ON public.trip_expense_shares;
DROP POLICY IF EXISTS "Members can update expense shares" ON public.trip_expense_shares;
DROP POLICY IF EXISTS "Members can delete expense shares" ON public.trip_expense_shares;
DROP POLICY IF EXISTS "Expense managers can insert shares" ON public.trip_expense_shares;
DROP POLICY IF EXISTS "Involved members can settle shares" ON public.trip_expense_shares;
DROP POLICY IF EXISTS "Expense managers can delete shares" ON public.trip_expense_shares;

CREATE POLICY "Expense managers can insert shares"
  ON public.trip_expense_shares FOR INSERT
  WITH CHECK (can_manage_trip_expense(expense_id));

-- Editing an expense replaces its shares (delete + insert), so UPDATE is only
-- used to settle debts. The column grants below limit it to the settled flags.
CREATE POLICY "Involved members can settle shares"
  ON public.trip_expense_shares FOR UPDATE
  USING (can_settle_trip_expense_share(expense_id, member_id))
  WITH CHECK (can_settle_trip_expense_share(expense_id, member_id));

CREATE POLICY "Expense managers can delete shares"
  ON public.trip_expense_shares FOR DELETE
  USING (can_manage_trip_expense(expense_id));

-- 6. Client updates on shares may only touch the settled flags
--    (a debtor must not be able to lower their own share_amount).
REVOKE UPDATE ON public.trip_expense_shares FROM anon, authenticated;
GRANT UPDATE (is_settled, settled_at) ON public.trip_expense_shares TO authenticated;

COMMIT;
