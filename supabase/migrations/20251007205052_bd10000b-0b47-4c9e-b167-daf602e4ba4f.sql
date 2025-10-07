-- Enable realtime for schedules table
ALTER TABLE public.schedules REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;

-- Enable realtime for absences table
ALTER TABLE public.absences REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.absences;