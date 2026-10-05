-- Multi-currency support migration (idempotent, single transaction).
--
-- Supabase run order:
--   a) Take a backup/export of your data first.
--   b) Run this script ONCE in the Supabase SQL Editor BEFORE deploying/running the app code.
--      It raises if views depend on money columns: drop/recreate those views first.
--   c) Re-run it to confirm it is a no-op.
--   d) Confirm the defaults trigger works (insert a row without money fields in each table,
--      including credit_installments inheriting from the purchase and loan_payments from the loan).
--   e) Confirm the browser (authenticated role) cannot INSERT into exchange_rates and cannot
--      UPDATE user_settings.base_currency.
--   f) Only then start the app.
BEGIN;
-- 0. Abort if views depend on money columns (ALTER TYPE would fail).
DO $$ DECLARE v TEXT; BEGIN
  SELECT string_agg(DISTINCT dv.relname, ', ') INTO v FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid JOIN pg_class dv ON dv.oid = r.ev_class
    JOIN pg_class t ON t.oid = d.refobjid
  WHERE t.relname IN ('transactions','expense_plans','services','credit_purchases','credit_installments',
        'investments','loans','loan_payments','trips','trip_expenses','trip_expense_shares') AND dv.oid <> t.oid;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'Drop/recreate dependent views first: %', v; END IF; END $$;

-- 1. user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL DEFAULT 'ARS' CHECK (base_currency ~ '^[A-Z]{3}$'),
  ars_rate_type TEXT NOT NULL DEFAULT 'oficial' CHECK (ars_rate_type IN ('oficial','blue','bolsa','tarjeta')),
  pending_base_currency TEXT CHECK (pending_base_currency ~ '^[A-Z]{3}$'),
  reconversion_status TEXT NOT NULL DEFAULT 'idle' CHECK (reconversion_status IN ('idle','running','failed')),
  reconversion_started_at TIMESTAMPTZ, reconversion_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_settings FROM anon, authenticated;
GRANT SELECT ON user_settings TO authenticated;
GRANT INSERT (user_id, ars_rate_type), UPDATE (ars_rate_type, updated_at) ON user_settings TO authenticated;
DROP POLICY IF EXISTS "own settings select" ON user_settings;
CREATE POLICY "own settings select" ON user_settings FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own settings insert" ON user_settings;
CREATE POLICY "own settings insert" ON user_settings FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own settings update" ON user_settings;
CREATE POLICY "own settings update" ON user_settings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- 2. exchange_rates cache (server-only writes via service_role, which bypasses RLS)
CREATE TABLE IF NOT EXISTS exchange_rates (
  rate_date DATE NOT NULL, currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  rate_type TEXT NOT NULL CHECK (rate_type IN ('oficial','blue','bolsa','tarjeta')),
  ars_per_unit NUMERIC(24,10) NOT NULL CHECK (ars_per_unit > 0),
  source TEXT NOT NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (currency, rate_type, rate_date));
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exchange_rates FROM anon, authenticated;
GRANT SELECT ON exchange_rates TO authenticated;
DROP POLICY IF EXISTS "rates readable" ON exchange_rates;
CREATE POLICY "rates readable" ON exchange_rates FOR SELECT TO authenticated USING (true);

-- 3. Widen money columns (only when the current precision is lower).
-- Unconstrained NUMERIC (numeric_precision IS NULL) is already unbounded: it is never altered, so
-- existing values keep their full precision instead of being rounded to 2 decimals.
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('transactions','amount',18),('transactions','balance_total',20),
    ('expense_plans','target_amount',18),('expense_plans','current_amount',18),
    ('services','amount',18),('credit_purchases','total_amount',18),('credit_purchases','monthly_amount',18),
    ('credit_installments','amount',18),('investments','amount',18),('investments','estimated_return',18),
    ('investments','actual_return',18),('loans','principal_amount',18),('loans','total_amount',18),
    ('loan_payments','amount',18),('trips','budget',18),('trip_expenses','amount',18),
    ('trip_expense_shares','share_amount',18)) AS x(tbl,col,prec)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
               AND table_name=c.tbl AND column_name=c.col AND data_type='numeric'
               AND numeric_precision IS NOT NULL AND numeric_precision < c.prec) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE NUMERIC(%s,2)', c.tbl, c.col, c.prec);
    END IF; END LOOP; END $$;

-- 4. Relax > 0 checks to >= 0 (drops any CHECK whose definition is "<money col> > 0")
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT con.conname, cl.relname FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
    WHERE con.contype='c' AND cl.relname IN ('investments','loans','loan_payments')
      AND pg_get_constraintdef(con.oid) ~ '\((amount|principal_amount|total_amount) > \(?0'
  LOOP EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.relname, r.conname); END LOOP; END $$;
-- New *_nonneg checks are added in step 8.

-- 5. investments: normalize pre-existing currency/exchange_rate of unknown type
ALTER TABLE investments ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10);
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='investments' AND column_name='currency') <> 'text' THEN
    ALTER TABLE investments ALTER COLUMN currency TYPE TEXT USING currency::text; END IF;
  IF (SELECT COALESCE(numeric_precision,0)::text || data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='investments' AND column_name='exchange_rate') <> '24numeric' THEN
    ALTER TABLE investments ALTER COLUMN exchange_rate TYPE NUMERIC(24,10)
      USING NULLIF(trim(exchange_rate::text), '')::numeric; END IF; END $$;
UPDATE investments SET currency = upper(trim(currency)) WHERE currency IS NOT NULL AND currency <> upper(trim(currency));

-- 6. Add pattern-M columns (explicit per table)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT, ADD COLUMN IF NOT EXISTS original_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10) DEFAULT 1, ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS base_currency TEXT;
ALTER TABLE credit_purchases ADD COLUMN IF NOT EXISTS currency TEXT, ADD COLUMN IF NOT EXISTS original_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10) DEFAULT 1, ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS base_currency TEXT;
ALTER TABLE credit_installments ADD COLUMN IF NOT EXISTS currency TEXT, ADD COLUMN IF NOT EXISTS original_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10) DEFAULT 1, ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS base_currency TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS currency TEXT, ADD COLUMN IF NOT EXISTS original_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10) DEFAULT 1, ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS base_currency TEXT;
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS currency TEXT, ADD COLUMN IF NOT EXISTS original_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10) DEFAULT 1, ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS base_currency TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS currency TEXT, ADD COLUMN IF NOT EXISTS original_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10) DEFAULT 1, ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS base_currency TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS original_amount NUMERIC(24,10),  -- units held
  ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto', ADD COLUMN IF NOT EXISTS base_currency TEXT;
ALTER TABLE investments ALTER COLUMN exchange_rate SET DEFAULT 1;
ALTER TABLE expense_plans ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE trip_expenses ADD COLUMN IF NOT EXISTS currency TEXT, ADD COLUMN IF NOT EXISTS original_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(24,10) DEFAULT 1, ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT 'auto';

-- 7. Backfill (existing data is ARS)
UPDATE transactions SET currency=COALESCE(currency,'ARS'), original_amount=COALESCE(original_amount,amount),
  exchange_rate=COALESCE(exchange_rate,1), rate_source=COALESCE(rate_source,'auto'), base_currency=COALESCE(base_currency,'ARS')
  WHERE currency IS NULL OR original_amount IS NULL OR exchange_rate IS NULL OR rate_source IS NULL OR base_currency IS NULL;
UPDATE credit_purchases SET currency=COALESCE(currency,'ARS'), original_amount=COALESCE(original_amount,total_amount),
  exchange_rate=COALESCE(exchange_rate,1), rate_source=COALESCE(rate_source,'auto'), base_currency=COALESCE(base_currency,'ARS')
  WHERE currency IS NULL OR original_amount IS NULL OR exchange_rate IS NULL OR rate_source IS NULL OR base_currency IS NULL;
UPDATE credit_installments SET currency=COALESCE(currency,'ARS'), original_amount=COALESCE(original_amount,amount),
  exchange_rate=COALESCE(exchange_rate,1), rate_source=COALESCE(rate_source,'auto'), base_currency=COALESCE(base_currency,'ARS')
  WHERE currency IS NULL OR original_amount IS NULL OR exchange_rate IS NULL OR rate_source IS NULL OR base_currency IS NULL;
UPDATE loans SET currency=COALESCE(currency,'ARS'), original_amount=COALESCE(original_amount,total_amount),
  exchange_rate=COALESCE(exchange_rate,1), rate_source=COALESCE(rate_source,'auto'), base_currency=COALESCE(base_currency,'ARS')
  WHERE currency IS NULL OR original_amount IS NULL OR exchange_rate IS NULL OR rate_source IS NULL OR base_currency IS NULL;
UPDATE loan_payments SET currency=COALESCE(currency,'ARS'), original_amount=COALESCE(original_amount,amount),
  exchange_rate=COALESCE(exchange_rate,1), rate_source=COALESCE(rate_source,'auto'), base_currency=COALESCE(base_currency,'ARS')
  WHERE currency IS NULL OR original_amount IS NULL OR exchange_rate IS NULL OR rate_source IS NULL OR base_currency IS NULL;
UPDATE services SET currency=COALESCE(currency,'ARS'), original_amount=COALESCE(original_amount,amount),
  exchange_rate=COALESCE(exchange_rate,1), rate_source=COALESCE(rate_source,'auto'), base_currency=COALESCE(base_currency,'ARS')
  WHERE currency IS NULL OR original_amount IS NULL OR exchange_rate IS NULL OR rate_source IS NULL OR base_currency IS NULL;
UPDATE investments SET currency=COALESCE(NULLIF(currency,''),'ARS'),
  exchange_rate=CASE WHEN exchange_rate IS NULL OR exchange_rate <= 0 THEN 1 ELSE exchange_rate END,
  base_currency=COALESCE(base_currency,'ARS')
  WHERE currency IS NULL OR currency='' OR exchange_rate IS NULL OR exchange_rate <= 0 OR base_currency IS NULL;
-- Legacy free-text currencies (e.g. 'Bitcoin', 'USDT ') must satisfy the investments currency CHECK
-- (^[A-Z0-9]{2,10}$) or the migration would abort when the constraint is added in step 8. Choice:
-- strip every non-alphanumeric character from the upper-cased value and cap it at 10 characters;
-- when fewer than 2 characters remain, use the ISO "no currency" code XXX. The CHECK is then added
-- fully validated (never NOT VALID, which would block later updates of legacy rows). Such rows are
-- marked rate_source='manual' below because their currency is not a supported one.
UPDATE investments SET currency = CASE
    WHEN length(regexp_replace(upper(currency), '[^A-Z0-9]', '', 'g')) >= 2
      THEN left(regexp_replace(upper(currency), '[^A-Z0-9]', '', 'g'), 10)
    ELSE 'XXX' END
  WHERE currency IS NOT NULL AND currency <> '' AND currency !~ '^[A-Z0-9]{2,10}$';
UPDATE investments SET original_amount = amount / exchange_rate WHERE original_amount IS NULL;
UPDATE investments SET rate_source = CASE
    WHEN currency IN ('ARS','USD','EUR','BRL','GBP','CHF','JPY','CAD','AUD','MXN','CNY') THEN 'auto' ELSE 'manual' END
  WHERE rate_source IS NULL OR (rate_source='auto' AND currency NOT IN ('ARS','USD','EUR','BRL','GBP','CHF','JPY','CAD','AUD','MXN','CNY'));
UPDATE trip_expenses e SET currency=COALESCE(e.currency,t.currency,'ARS'), original_amount=COALESCE(e.original_amount,e.amount),
  exchange_rate=COALESCE(e.exchange_rate,1), rate_source=COALESCE(e.rate_source,'auto')
  FROM trips t WHERE t.id=e.trip_id AND (e.currency IS NULL OR e.original_amount IS NULL OR e.exchange_rate IS NULL OR e.rate_source IS NULL);

-- 8. Constraints (idempotent helper; currency regex is relaxed for investments)
CREATE OR REPLACE FUNCTION pg_temp.add_check(tbl TEXT, nm TEXT, def TEXT) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = nm) THEN
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)', tbl, nm, def); END IF; END $$;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','credit_purchases','credit_installments','loans','loan_payments','services','investments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN currency SET NOT NULL, ALTER COLUMN original_amount SET NOT NULL,
      ALTER COLUMN exchange_rate SET NOT NULL, ALTER COLUMN rate_source SET NOT NULL, ALTER COLUMN base_currency SET NOT NULL', t);
    PERFORM pg_temp.add_check(t, t||'_rate_source_chk', 'rate_source IN (''auto'',''manual'')');
    PERFORM pg_temp.add_check(t, t||'_exchange_rate_chk', 'exchange_rate > 0');
    PERFORM pg_temp.add_check(t, t||'_original_amount_chk', 'original_amount >= 0');
    PERFORM pg_temp.add_check(t, t||'_base_currency_chk', 'base_currency ~ ''^[A-Z]{3}$''');
    PERFORM pg_temp.add_check(t, t||'_currency_chk',
      CASE WHEN t='investments' THEN 'currency ~ ''^[A-Z0-9]{2,10}$''' ELSE 'currency ~ ''^[A-Z]{3}$''' END);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s, base_currency)', 'idx_'||t||'_base', t,
      CASE t WHEN 'credit_installments' THEN 'credit_purchase_id' WHEN 'loan_payments' THEN 'loan_id' ELSE 'user_id' END);
  END LOOP;
  PERFORM pg_temp.add_check('investments','investments_amount_nonneg','amount >= 0');
  PERFORM pg_temp.add_check('loans','loans_principal_nonneg','principal_amount >= 0');
  PERFORM pg_temp.add_check('loans','loans_total_nonneg','total_amount >= 0');
  PERFORM pg_temp.add_check('loan_payments','loan_payments_amount_nonneg','amount >= 0');
  ALTER TABLE trip_expenses ALTER COLUMN currency SET NOT NULL, ALTER COLUMN original_amount SET NOT NULL,
    ALTER COLUMN exchange_rate SET NOT NULL, ALTER COLUMN rate_source SET NOT NULL;
  PERFORM pg_temp.add_check('trip_expenses','trip_expenses_rate_source_chk','rate_source IN (''auto'',''manual'')');
  PERFORM pg_temp.add_check('trip_expenses','trip_expenses_exchange_rate_chk','exchange_rate > 0');
END $$;

-- 9. Defaults trigger: covers all tables; child tables inherit from their parent
CREATE OR REPLACE FUNCTION public.fill_money_defaults() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path = public AS $$
DECLARE b TEXT; p_cur TEXT; p_rate NUMERIC; p_src TEXT; p_base TEXT; has_parent BOOLEAN := false; base_amt NUMERIC; old_amt NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'trip_expenses' THEN
    IF TG_OP = 'INSERT' AND NEW.currency IS NULL THEN
      SELECT currency INTO b FROM trips WHERE id = NEW.trip_id; NEW.currency := COALESCE(b, 'ARS'); END IF;
    base_amt := NEW.amount;
    IF TG_OP = 'UPDATE' THEN old_amt := OLD.amount; END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      IF TG_TABLE_NAME = 'credit_installments' THEN
        SELECT currency, exchange_rate, rate_source, base_currency INTO p_cur, p_rate, p_src, p_base
          FROM credit_purchases WHERE id = NEW.credit_purchase_id; has_parent := FOUND;
      ELSIF TG_TABLE_NAME = 'loan_payments' THEN
        SELECT currency, exchange_rate, rate_source, base_currency INTO p_cur, p_rate, p_src, p_base
          FROM loans WHERE id = NEW.loan_id; has_parent := FOUND;
      END IF;
      IF has_parent THEN  -- child: inherit from parent
        NEW.currency := COALESCE(NEW.currency, p_cur); NEW.base_currency := COALESCE(NEW.base_currency, p_base);
        IF NEW.original_amount IS NULL THEN NEW.exchange_rate := p_rate; NEW.rate_source := p_src; END IF;
      ELSE
        IF TG_TABLE_NAME NOT IN ('credit_installments','loan_payments') THEN
          SELECT base_currency INTO b FROM user_settings WHERE user_id = NEW.user_id; END IF;
        NEW.base_currency := COALESCE(NEW.base_currency, b, 'ARS');
        NEW.currency := COALESCE(NEW.currency, NEW.base_currency);
      END IF;
    END IF;
    IF TG_TABLE_NAME IN ('credit_purchases','loans') THEN
      base_amt := NEW.total_amount; IF TG_OP = 'UPDATE' THEN old_amt := OLD.total_amount; END IF;
    ELSE
      base_amt := NEW.amount; IF TG_OP = 'UPDATE' THEN old_amt := OLD.amount; END IF;
    END IF;
  END IF;
  NEW.exchange_rate := COALESCE(NEW.exchange_rate, 1); NEW.rate_source := COALESCE(NEW.rate_source, 'auto');
  IF TG_OP = 'INSERT' THEN
    NEW.original_amount := COALESCE(NEW.original_amount, base_amt / NEW.exchange_rate);
  ELSIF base_amt IS DISTINCT FROM old_amt AND NEW.original_amount IS NOT DISTINCT FROM OLD.original_amount
        AND NEW.exchange_rate IS NOT DISTINCT FROM OLD.exchange_rate THEN
    NEW.original_amount := base_amt / NEW.exchange_rate;  -- legacy paths that update only amount
  END IF;
  RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.fill_money_defaults() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','credit_purchases','credit_installments','loans','loan_payments',
                           'services','investments','trip_expenses'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_fill_money_defaults ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_fill_money_defaults BEFORE INSERT OR UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.fill_money_defaults()', t);
  END LOOP; END $$;
COMMIT;
