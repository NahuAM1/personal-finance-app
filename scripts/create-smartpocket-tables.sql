-- ============================================
-- SmartPocket Tables - Personal Wallet Premium
-- ============================================

-- 1. Tickets (scanned receipts)
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  ticket_date DATE NOT NULL,
  image_path TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_ticket_date ON tickets(ticket_date);

-- 2. Ticket Items (extracted items from each ticket)
CREATE TABLE ticket_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,3) DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_items_ticket_id ON ticket_items(ticket_id);

-- 3. Split Groups (groups for splitting expenses)
CREATE TABLE split_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'ARS',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Split Group Members
CREATE TABLE split_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES split_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  invite_token TEXT UNIQUE,
  invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, email)
);

CREATE INDEX idx_split_group_members_group_id ON split_group_members(group_id);
CREATE INDEX idx_split_group_members_user_id ON split_group_members(user_id);
CREATE INDEX idx_split_group_members_invite_token ON split_group_members(invite_token);

-- 5. Split Expenses (shared expenses in a group)
CREATE TABLE split_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES split_groups(id) ON DELETE CASCADE NOT NULL,
  paid_by_member_id UUID REFERENCES split_group_members(id) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT,
  expense_date DATE NOT NULL,
  split_method TEXT DEFAULT 'equal' CHECK (split_method IN ('equal', 'custom', 'percentage')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_split_expenses_group_id ON split_expenses(group_id);

-- 6. Split Expense Shares (how much each member owes per expense)
CREATE TABLE split_expense_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES split_expenses(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES split_group_members(id) ON DELETE CASCADE NOT NULL,
  share_amount NUMERIC(12,2) NOT NULL,
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  UNIQUE(expense_id, member_id)
);

CREATE INDEX idx_split_expense_shares_expense_id ON split_expense_shares(expense_id);
CREATE INDEX idx_split_expense_shares_member_id ON split_expense_shares(member_id);

-- ============================================
-- Updated_at triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_groups_updated_at
  BEFORE UPDATE ON split_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_expenses_updated_at
  BEFORE UPDATE ON split_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_expense_shares ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER helper function
-- Bypasses RLS to check group membership without infinite recursion
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

-- Tickets: users can only access their own tickets
CREATE POLICY "Users can view own tickets"
  ON tickets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tickets"
  ON tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets"
  ON tickets FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tickets"
  ON tickets FOR DELETE USING (auth.uid() = user_id);

-- Ticket Items: access via ticket ownership
CREATE POLICY "Users can view own ticket items"
  ON ticket_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets WHERE tickets.id = ticket_items.ticket_id AND tickets.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own ticket items"
  ON ticket_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets WHERE tickets.id = ticket_items.ticket_id AND tickets.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own ticket items"
  ON ticket_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tickets WHERE tickets.id = ticket_items.ticket_id AND tickets.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own ticket items"
  ON ticket_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tickets WHERE tickets.id = ticket_items.ticket_id AND tickets.user_id = auth.uid()
  ));

-- Split Groups: access via membership (uses SECURITY DEFINER function)
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

-- Split Group Members: uses SECURITY DEFINER to avoid self-referencing recursion
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

-- Split Expenses: access via group membership (uses SECURITY DEFINER)
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

-- Split Expense Shares: access via expense's group membership
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

-- ============================================
-- Storage Bucket for receipts
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', FALSE);

CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
