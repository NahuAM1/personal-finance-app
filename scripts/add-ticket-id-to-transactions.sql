-- Migration: Add ticket_id column to transactions table
-- Links expenses created from scanned tickets to their source ticket
-- ON DELETE CASCADE ensures the transaction is deleted when the ticket is deleted

ALTER TABLE transactions
ADD COLUMN ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE DEFAULT NULL;

-- Index for fast lookup by ticket_id
CREATE INDEX idx_transactions_ticket_id ON transactions(ticket_id);

COMMENT ON COLUMN transactions.ticket_id IS
'Reference to the ticket that originated this expense. NULL for manually created transactions.';
