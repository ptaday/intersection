
-- Drop the restrictive mood check constraint to allow "workout" and custom moods
ALTER TABLE public.hang_sessions DROP CONSTRAINT hang_sessions_mood_check;
