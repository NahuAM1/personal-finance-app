-- ============================================
-- FIX: Drop recursive RLS policies and recreate with SECURITY DEFINER
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop ALL existing split-related policies
DROP POLICY IF EXISTS "Members can view their groups" ON split_groups;
DROP POLICY IF EXISTS "Users can create groups" ON split_groups;
DROP POLICY IF EXISTS "Group creators can update groups" ON split_groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON split_groups;

DROP POLICY IF EXISTS "Members can view group members" ON split_group_members;
DROP POLICY IF EXISTS "Group admins can insert members" ON split_group_members;
DROP POLICY IF EXISTS "Members can update own membership" ON split_group_members;
DROP POLICY IF EXISTS "Group creators can delete members" ON split_group_members;
DROP POLICY IF EXISTS "Group admins can delete members" ON split_group_members;

DROP POLICY IF EXISTS "Members can view group expenses" ON split_expenses;
DROP POLICY IF EXISTS "Members can insert group expenses" ON split_expenses;
DROP POLICY IF EXISTS "Members can update group expenses" ON split_expenses;
DROP POLICY IF EXISTS "Members can delete group expenses" ON split_expenses;

DROP POLICY IF EXISTS "Members can view expense shares" ON split_expense_shares;
DROP POLICY IF EXISTS "Members can insert expense shares" ON split_expense_shares;
DROP POLICY IF EXISTS "Members can update expense shares" ON split_expense_shares;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS is_group_member(UUID);
DROP FUNCTION IF EXISTS is_group_admin(UUID);

-- ============================================
-- SECURITY DEFINER helper functions
-- These bypass RLS to check membership without infinite recursion
-- ============================================

CREATE OR REPLACE FUNCTION is_group_member(gid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM split_group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_group_admin(gid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM split_group_members
    WHERE group_id = gid AND user_id = auth.uid() AND is_admin = TRUE
  ) OR EXISTS (
    SELECT 1 FROM split_groups
    WHERE id = gid AND created_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Recreate policies using SECURITY DEFINER functions
-- ============================================

-- Split Groups
CREATE POLICY "Members can view their groups"
  ON split_groups FOR SELECT
  USING (created_by = auth.uid() OR is_group_member(id));

CREATE POLICY "Users can create groups"
  ON split_groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update groups"
  ON split_groups FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Group creators can delete groups"
  ON split_groups FOR DELETE
  USING (auth.uid() = created_by);

-- Split Group Members (NO self-referencing, uses SECURITY DEFINER)
CREATE POLICY "Members can view group members"
  ON split_group_members FOR SELECT
  USING (is_group_member(group_id) OR is_group_admin(group_id));

CREATE POLICY "Group admins can insert members"
  ON split_group_members FOR INSERT
  WITH CHECK (is_group_admin(group_id));

CREATE POLICY "Members can update own membership"
  ON split_group_members FOR UPDATE
  USING (user_id = auth.uid() OR is_group_admin(group_id));

CREATE POLICY "Group admins can delete members"
  ON split_group_members FOR DELETE
  USING (is_group_admin(group_id));

-- Split Expenses
CREATE POLICY "Members can view group expenses"
  ON split_expenses FOR SELECT
  USING (is_group_member(group_id));

CREATE POLICY "Members can insert group expenses"
  ON split_expenses FOR INSERT
  WITH CHECK (is_group_member(group_id));

CREATE POLICY "Members can update group expenses"
  ON split_expenses FOR UPDATE
  USING (is_group_member(group_id));

CREATE POLICY "Members can delete group expenses"
  ON split_expenses FOR DELETE
  USING (is_group_member(group_id));

-- Split Expense Shares
CREATE POLICY "Members can view expense shares"
  ON split_expense_shares FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM split_expenses
    WHERE split_expenses.id = split_expense_shares.expense_id
    AND is_group_member(split_expenses.group_id)
  ));

CREATE POLICY "Members can insert expense shares"
  ON split_expense_shares FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM split_expenses
    WHERE split_expenses.id = split_expense_shares.expense_id
    AND is_group_member(split_expenses.group_id)
  ));

CREATE POLICY "Members can update expense shares"
  ON split_expense_shares FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM split_expenses
    WHERE split_expenses.id = split_expense_shares.expense_id
    AND is_group_member(split_expenses.group_id)
  ));
