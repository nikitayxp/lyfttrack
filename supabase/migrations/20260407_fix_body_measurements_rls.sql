-- Ensure body_measurements RLS is enabled and own-row policies exist for authenticated users.

begin;

alter table if exists public.body_measurements enable row level security;

-- SELECT own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'body_measurements'
      AND policyname = 'body_measurements_select_own'
  ) THEN
    CREATE POLICY body_measurements_select_own
      ON public.body_measurements
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- INSERT own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'body_measurements'
      AND policyname = 'body_measurements_insert_own'
  ) THEN
    CREATE POLICY body_measurements_insert_own
      ON public.body_measurements
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

-- UPDATE own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'body_measurements'
      AND policyname = 'body_measurements_update_own'
  ) THEN
    CREATE POLICY body_measurements_update_own
      ON public.body_measurements
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

commit;
