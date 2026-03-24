
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  reward_applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals as referrer"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view referrals where they are referred"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referred_id);

CREATE POLICY "Users can insert referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Anon can insert referrals for signup"
  ON public.referrals FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access"
  ON public.referrals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX idx_referrals_referred ON public.referrals(referred_id);
