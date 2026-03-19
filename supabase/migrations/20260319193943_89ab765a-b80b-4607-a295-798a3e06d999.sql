
-- Delete all data for Bruno's two accounts
DELETE FROM public.inbox_messages WHERE user_id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');
DELETE FROM public.tasks WHERE user_id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');
DELETE FROM public.transactions WHERE user_id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');
DELETE FROM public.meetings WHERE user_id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');
DELETE FROM public.memory_settings WHERE user_id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');
DELETE FROM public.projects WHERE user_id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');
DELETE FROM public.profiles WHERE id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');

-- Delete auth users (this removes login credentials)
DELETE FROM auth.users WHERE id IN ('dc2374b3-0695-495a-86b0-a63e288c5573', 'e266f9e1-2299-49ab-9922-c727bb36595f');
