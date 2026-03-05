
-- 1. profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'FREE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 2. tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'baixa',
  status TEXT NOT NULL DEFAULT 'pendente',
  due_date TIMESTAMPTZ,
  project TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- 3. transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- 4. meetings
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'agendada',
  participants INTEGER DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meetings" ON public.meetings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meetings" ON public.meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meetings" ON public.meetings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meetings" ON public.meetings FOR DELETE USING (auth.uid() = user_id);

-- 5. projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'bg-info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- 6. inbox_messages
CREATE TABLE public.inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  response TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inbox" ON public.inbox_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inbox" ON public.inbox_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inbox" ON public.inbox_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own inbox" ON public.inbox_messages FOR DELETE USING (auth.uid() = user_id);

-- 7. memory_settings
CREATE TABLE public.memory_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.memory_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory" ON public.memory_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memory" ON public.memory_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memory" ON public.memory_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own memory" ON public.memory_settings FOR DELETE USING (auth.uid() = user_id);
