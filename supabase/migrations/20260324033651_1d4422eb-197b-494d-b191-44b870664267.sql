
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_date timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT NULL;
