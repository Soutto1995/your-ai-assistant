
-- Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- RLS policies for refunds
CREATE POLICY "Users can view own refunds" ON refunds FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own refunds" ON refunds FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
