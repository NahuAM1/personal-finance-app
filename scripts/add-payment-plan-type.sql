-- Migration: Add 'payment_plan' to loan_type
-- Run this in Supabase SQL Editor

-- If loan_type is a PostgreSQL enum:
-- ALTER TYPE loan_type ADD VALUE 'payment_plan';

-- If loan_type is a varchar/text column with a CHECK constraint,
-- drop the old constraint and add a new one:
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_loan_type_check;
ALTER TABLE loans ADD CONSTRAINT loans_loan_type_check
  CHECK (loan_type IN ('given', 'received', 'payment_plan'));
