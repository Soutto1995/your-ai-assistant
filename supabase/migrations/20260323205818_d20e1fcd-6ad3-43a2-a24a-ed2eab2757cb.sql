-- Rename meetings table to events
ALTER TABLE public.meetings RENAME TO events;

-- Add new calendar columns
ALTER TABLE public.events
ADD COLUMN event_date DATE,
ADD COLUMN event_time TIME,
ADD COLUMN category VARCHAR(50) DEFAULT 'compromisso',
ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;

-- Rename columns to new standard
ALTER TABLE public.events RENAME COLUMN meeting_date TO legacy_meeting_date;
ALTER TABLE public.events RENAME COLUMN summary TO description;

-- Backfill event_date from legacy_meeting_date
UPDATE public.events
SET event_date = legacy_meeting_date::date,
    event_time = legacy_meeting_date::time
WHERE legacy_meeting_date IS NOT NULL;

-- Rename RLS policies to match new table name
ALTER POLICY "Users can delete own meetings" ON public.events RENAME TO "Users can delete own events";
ALTER POLICY "Users can insert own meetings" ON public.events RENAME TO "Users can insert own events";
ALTER POLICY "Users can update own meetings" ON public.events RENAME TO "Users can update own events";
ALTER POLICY "Users can view own meetings" ON public.events RENAME TO "Users can view own events";