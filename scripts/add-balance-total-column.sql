-- Migration: Add balance_total column to transactions table
-- This column tracks the cumulative balance after each transaction
-- For existing transactions, the value will be NULL (indicating no historical data)
-- For new transactions, the value will be calculated and stored

-- Add the balance_total column (nullable to support existing records)
ALTER TABLE transactions
ADD COLUMN balance_total DECIMAL(10, 2) DEFAULT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN transactions.balance_total IS
'Cumulative balance after this transaction. NULL for legacy transactions (created before this feature), calculated value for new transactions.';

-- Create an index for performance when querying by balance_total
CREATE INDEX idx_transactions_balance_total ON transactions(balance_total);

-- Optional: Add a comment to help identify legacy vs new transactions
COMMENT ON TABLE transactions IS
'Financial transactions. Transactions with balance_total = NULL are legacy records created before balance tracking was implemented.';
