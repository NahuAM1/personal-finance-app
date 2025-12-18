-- Migration: Create investments tracking system
-- Date: 2025-10-29
-- Investment types for Argentina market

-- Create investments table
CREATE TABLE IF NOT EXISTS public.investments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    investment_type VARCHAR(50) NOT NULL CHECK (investment_type IN (
        'plazo_fijo',
        'fci',
        'bonos',
        'acciones',
        'crypto',
        'letras',
        'cedears',
        'cauciones',
        'fondos_comunes_inversion',
        'compra_divisas'
    )),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    start_date DATE NOT NULL,
    maturity_date DATE,
    annual_rate DECIMAL(5,2),
    estimated_return DECIMAL(12,2) DEFAULT 0,
    is_liquidated BOOLEAN DEFAULT FALSE NOT NULL,
    liquidation_date DATE,
    actual_return DECIMAL(12,2),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for investments
CREATE POLICY "Users can view own investments" ON public.investments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investments" ON public.investments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investments" ON public.investments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investments" ON public.investments
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_start_date ON public.investments(start_date);
CREATE INDEX IF NOT EXISTS idx_investments_maturity_date ON public.investments(maturity_date);
CREATE INDEX IF NOT EXISTS idx_investments_is_liquidated ON public.investments(is_liquidated);
CREATE INDEX IF NOT EXISTS idx_investments_type ON public.investments(investment_type);

-- Create trigger for updated_at
CREATE TRIGGER update_investments_updated_at
    BEFORE UPDATE ON public.investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.investments IS 'Stores user investments with tracking of liquidation status';
COMMENT ON COLUMN public.investments.investment_type IS 'Type of investment: plazo_fijo, fci, bonos, acciones, crypto, letras, cedears, cauciones, fondos_comunes_inversion';
COMMENT ON COLUMN public.investments.amount IS 'Initial investment amount (capital)';
COMMENT ON COLUMN public.investments.annual_rate IS 'Annual interest rate (TNA) in percentage';
COMMENT ON COLUMN public.investments.estimated_return IS 'Estimated profit at maturity';
COMMENT ON COLUMN public.investments.is_liquidated IS 'Whether the investment has been liquidated/cashed out';
COMMENT ON COLUMN public.investments.actual_return IS 'Actual profit received upon liquidation';
COMMENT ON COLUMN public.investments.transaction_id IS 'References the transaction created when investment is liquidated (NULL until liquidated)';
