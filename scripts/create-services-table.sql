-- ============================================
-- Services module: services table + transactions.service_id link
-- ============================================

-- 1. Services table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(200) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('automatic', 'manual')),
    icon VARCHAR(50),
    color VARCHAR(20),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Link column on transactions (nullable FK, SET NULL on service delete)
ALTER TABLE IF EXISTS public.transactions
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- 2b. Idempotency guard: one automatic-service charge per service per period.
--     period_key is a generated YYYY-MM stamp derived from the transaction date.
--     A partial unique index (only where service_id IS NOT NULL) prevents two
--     concurrent sessions/tabs/devices — and React StrictMode double-mounts —
--     from charging the same service twice in the same month.
--     NOTE: we deliberately do NOT use to_char(). to_char(<datetime>, text) is
--     marked STABLE (volatility is per-function, not per-format-string: its output
--     can depend on the lc_time locale GUC), so a generated column rejects it
--     (ERROR 42P17: generation expression is not immutable) no matter how `date`
--     is cast. EXTRACT(... FROM date) on a plain DATE column IS immutable, and
--     integer/text concatenation is immutable, so we build 'YYYY-MM' by hand.
ALTER TABLE IF EXISTS public.transactions
    ADD COLUMN IF NOT EXISTS period_key TEXT GENERATED ALWAYS AS (
        EXTRACT(YEAR FROM date)::int::text
        || '-' ||
        LPAD(EXTRACT(MONTH FROM date)::int::text, 2, '0')
    ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_service_period
    ON public.transactions (service_id, period_key)
    WHERE service_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE IF EXISTS public.services ENABLE ROW LEVEL SECURITY;

-- 4. Indexes (idx_<table>_<column> convention)
CREATE INDEX IF NOT EXISTS idx_services_user_id ON public.services(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_service_id ON public.transactions(service_id);

-- 5. updated_at trigger (reuse shared function from create-tables.sql)
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. RLS policies (idempotent DROP + CREATE, setup-rls.sql canonical naming)
DROP POLICY IF EXISTS "Users can view their own services" ON public.services;
DROP POLICY IF EXISTS "Users can insert their own services" ON public.services;
DROP POLICY IF EXISTS "Users can update their own services" ON public.services;
DROP POLICY IF EXISTS "Users can delete their own services" ON public.services;

CREATE POLICY "Users can view their own services"
  ON public.services FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own services"
  ON public.services FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own services"
  ON public.services FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own services"
  ON public.services FOR DELETE
  USING (auth.uid() = user_id);

GRANT ALL ON public.services TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
