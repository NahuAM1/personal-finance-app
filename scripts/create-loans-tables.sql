-- Migration: Create loans tracking system
-- Date: 2026-03-18
-- Supports tracking loans given (money lent to others) and loans received (money borrowed)

-- Create loans table (main loan record)
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    loan_type VARCHAR(20) NOT NULL CHECK (loan_type IN ('given', 'received')),
    counterparty_name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    principal_amount DECIMAL(12,2) NOT NULL CHECK (principal_amount > 0),
    interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('single', 'installments')),
    installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    start_date DATE NOT NULL,
    due_date DATE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loan_payments table (individual payments/installments)
CREATE TABLE IF NOT EXISTS public.loan_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
    payment_number INTEGER NOT NULL CHECK (payment_number > 0),
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    paid BOOLEAN DEFAULT FALSE NOT NULL,
    paid_date DATE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(loan_id, payment_number)
);

-- Enable RLS
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loans
CREATE POLICY "Users can view own loans" ON public.loans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loans" ON public.loans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loans" ON public.loans
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own loans" ON public.loans
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for loan_payments
-- Users can only access payments of their own loans
CREATE POLICY "Users can view own loan payments" ON public.loan_payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.loans
            WHERE loans.id = loan_payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own loan payments" ON public.loan_payments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.loans
            WHERE loans.id = loan_payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own loan payments" ON public.loan_payments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.loans
            WHERE loans.id = loan_payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own loan payments" ON public.loan_payments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.loans
            WHERE loans.id = loan_payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON public.loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_loan_type ON public.loans(loan_type);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_start_date ON public.loans(start_date);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON public.loans(due_date);

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON public.loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_due_date ON public.loan_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_paid ON public.loan_payments(paid);
CREATE INDEX IF NOT EXISTS idx_loan_payments_transaction_id ON public.loan_payments(transaction_id);

-- Create triggers for updated_at
CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON public.loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loan_payments_updated_at
    BEFORE UPDATE ON public.loan_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.loans IS 'Stores loans given to others and received from others';
COMMENT ON TABLE public.loan_payments IS 'Individual payments/installments for loans. Transactions are created when payments are registered.';

COMMENT ON COLUMN public.loans.loan_type IS 'given = money lent to someone, received = money borrowed from someone';
COMMENT ON COLUMN public.loans.counterparty_name IS 'Name of the person/entity the loan is with';
COMMENT ON COLUMN public.loans.principal_amount IS 'Original loan amount without interest';
COMMENT ON COLUMN public.loans.interest_rate IS 'Simple interest rate as percentage (0 = no interest)';
COMMENT ON COLUMN public.loans.total_amount IS 'Total amount including interest (principal * (1 + rate/100))';
COMMENT ON COLUMN public.loans.payment_mode IS 'single = one-time payment, installments = multiple payments';
COMMENT ON COLUMN public.loans.transaction_id IS 'References the transaction created when loan was originated';
COMMENT ON COLUMN public.loan_payments.transaction_id IS 'References the transaction created when this payment was made (NULL until paid)';
