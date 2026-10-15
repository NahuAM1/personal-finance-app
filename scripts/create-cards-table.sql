CREATE TABLE IF NOT EXISTS public.cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL CHECK (length(btrim(name)) > 0),
    network VARCHAR(20) NOT NULL CHECK (network IN ('visa', 'mastercard', 'amex', 'cabal', 'naranja', 'other')),
    last_four VARCHAR(4) CHECK (last_four ~ '^[0-9]{4}$'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT cards_id_user_id_key UNIQUE (id, user_id)
);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cards_user_id ON public.cards(user_id);

DROP TRIGGER IF EXISTS update_cards_updated_at ON public.cards;
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP POLICY IF EXISTS "Users can view their own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can insert their own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.cards;

CREATE POLICY "Users can view their own cards"
  ON public.cards FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own cards"
  ON public.cards FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own cards"
  ON public.cards FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own cards"
  ON public.cards FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;

ALTER TABLE public.credit_purchases ADD COLUMN IF NOT EXISTS card_id UUID;

ALTER TABLE public.credit_purchases DROP CONSTRAINT IF EXISTS credit_purchases_card_id_user_id_fkey;
ALTER TABLE public.credit_purchases
    ADD CONSTRAINT credit_purchases_card_id_user_id_fkey
    FOREIGN KEY (card_id, user_id) REFERENCES public.cards(id, user_id)
    ON DELETE SET NULL (card_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_card_id ON public.credit_purchases(card_id);
