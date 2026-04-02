DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'routine_exercises'
      AND c.conname = 'routine_exercises_routine_day_id_fk'
  ) THEN
    ALTER TABLE public.routine_exercises
    ADD CONSTRAINT routine_exercises_routine_day_id_fk
    FOREIGN KEY (routine_day_id)
    REFERENCES public.routine_days(id)
    ON DELETE CASCADE
    NOT VALID;
  END IF;
END $$;
