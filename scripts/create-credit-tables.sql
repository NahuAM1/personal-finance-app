-- Migration: Create credit card purchase tracking system
-- Date: 2025-10-29
-- This replaces the old credit tracking system with a cleaner structure

-- Create credit_purchases table (main purchase record)
CREATE TABLE IF NOT EXISTS public.credit_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    installments INTEGER NOT NULL CHECK (installments > 0),
    monthly_amount DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit_installments table (individual installments)
CREATE TABLE IF NOT EXISTS public.credit_installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    credit_purchase_id UUID REFERENCES public.credit_purchases(id) ON DELETE CASCADE NOT NULL,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid BOOLEAN DEFAULT FALSE NOT NULL,
    paid_date DATE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(credit_purchase_id, installment_number)
);

-- Enable RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_installments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_purchases
CREATE POLICY "Users can view own credit purchases" ON public.credit_purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit purchases" ON public.credit_purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit purchases" ON public.credit_purchases
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credit purchases" ON public.credit_purchases
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for credit_installments
-- Users can only access installments of their own purchases
CREATE POLICY "Users can view own credit installments" ON public.credit_installments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.credit_purchases
            WHERE credit_purchases.id = credit_installments.credit_purchase_id
            AND credit_purchases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own credit installments" ON public.credit_installments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.credit_purchases
            WHERE credit_purchases.id = credit_installments.credit_purchase_id
            AND credit_purchases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own credit installments" ON public.credit_installments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.credit_purchases
            WHERE credit_purchases.id = credit_installments.credit_purchase_id
            AND credit_purchases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own credit installments" ON public.credit_installments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.credit_purchases
            WHERE credit_purchases.id = credit_installments.credit_purchase_id
            AND credit_purchases.user_id = auth.uid()
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON public.credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_start_date ON public.credit_purchases(start_date);

CREATE INDEX IF NOT EXISTS idx_credit_installments_purchase_id ON public.credit_installments(credit_purchase_id);
CREATE INDEX IF NOT EXISTS idx_credit_installments_due_date ON public.credit_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_credit_installments_paid ON public.credit_installments(paid);
CREATE INDEX IF NOT EXISTS idx_credit_installments_transaction_id ON public.credit_installments(transaction_id);

-- Create triggers for updated_at
CREATE TRIGGER update_credit_purchases_updated_at
    BEFORE UPDATE ON public.credit_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_installments_updated_at
    BEFORE UPDATE ON public.credit_installments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.credit_purchases IS 'Stores credit card purchases with installment plans';
COMMENT ON TABLE public.credit_installments IS 'Individual installments for credit card purchases. Transactions are created only when marked as paid.';

COMMENT ON COLUMN public.credit_installments.paid IS 'Indicates if installment has been paid';
COMMENT ON COLUMN public.credit_installments.paid_date IS 'Actual date when installment was paid (NULL if not paid)';
COMMENT ON COLUMN public.credit_installments.transaction_id IS 'References the transaction created when this installment was paid (NULL until paid)';
