-- Enable Row Level Security on all tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view their own expense plans" ON expense_plans;
DROP POLICY IF EXISTS "Users can insert their own expense plans" ON expense_plans;
DROP POLICY IF EXISTS "Users can update their own expense plans" ON expense_plans;
DROP POLICY IF EXISTS "Users can delete their own expense plans" ON expense_plans;

-- Create policies for transactions table
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for expense_plans table
CREATE POLICY "Users can view their own expense plans"
  ON expense_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expense plans"
  ON expense_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expense plans"
  ON expense_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expense plans"
  ON expense_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON expense_plans TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;