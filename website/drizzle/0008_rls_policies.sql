CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), ''),
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  );
$$;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE plate_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_exercise_prs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares_inbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'categories_owner_rw') THEN
    CREATE POLICY categories_owner_rw ON categories
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'badges' AND policyname = 'badges_owner_rw') THEN
    CREATE POLICY badges_owner_rw ON badges
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exercise_badges' AND policyname = 'exercise_badges_owner_rw') THEN
    CREATE POLICY exercise_badges_owner_rw ON exercise_badges
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exercises' AND policyname = 'exercises_owner_rw') THEN
    CREATE POLICY exercises_owner_rw ON exercises
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workouts' AND policyname = 'workouts_owner_rw') THEN
    CREATE POLICY workouts_owner_rw ON workouts
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workout_sets' AND policyname = 'workout_sets_owner_rw') THEN
    CREATE POLICY workout_sets_owner_rw ON workout_sets
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routines' AND policyname = 'routines_owner_rw') THEN
    CREATE POLICY routines_owner_rw ON routines
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routine_days' AND policyname = 'routine_days_owner_rw') THEN
    CREATE POLICY routine_days_owner_rw ON routine_days
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routine_exercises' AND policyname = 'routine_exercises_owner_rw') THEN
    CREATE POLICY routine_exercises_owner_rw ON routine_exercises
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'measurements' AND policyname = 'measurements_owner_rw') THEN
    CREATE POLICY measurements_owner_rw ON measurements
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goals' AND policyname = 'goals_owner_rw') THEN
    CREATE POLICY goals_owner_rw ON goals
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'body_metrics' AND policyname = 'body_metrics_owner_rw') THEN
    CREATE POLICY body_metrics_owner_rw ON body_metrics
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plate_inventory' AND policyname = 'plate_inventory_owner_rw') THEN
    CREATE POLICY plate_inventory_owner_rw ON plate_inventory
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'settings' AND policyname = 'settings_owner_rw') THEN
    CREATE POLICY settings_owner_rw ON settings
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_owner_rw') THEN
    CREATE POLICY user_profiles_owner_rw ON user_profiles
      USING (id = app.current_user_id())
      WITH CHECK (id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'score_events' AND policyname = 'score_events_owner_rw') THEN
    CREATE POLICY score_events_owner_rw ON score_events
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_exercise_prs' AND policyname = 'user_exercise_prs_owner_rw') THEN
    CREATE POLICY user_exercise_prs_owner_rw ON user_exercise_prs
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_feed' AND policyname = 'activity_feed_owner_rw') THEN
    CREATE POLICY activity_feed_owner_rw ON activity_feed
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'changelog_reactions' AND policyname = 'changelog_reactions_owner_rw') THEN
    CREATE POLICY changelog_reactions_owner_rw ON changelog_reactions
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kudos' AND policyname = 'kudos_owner_rw') THEN
    CREATE POLICY kudos_owner_rw ON kudos
      USING (giver_id = app.current_user_id())
      WITH CHECK (giver_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'weather_logs' AND policyname = 'weather_logs_owner_rw') THEN
    CREATE POLICY weather_logs_owner_rw ON weather_logs
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_reactions' AND policyname = 'notification_reactions_owner_rw') THEN
    CREATE POLICY notification_reactions_owner_rw ON notification_reactions
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_seen' AND policyname = 'activity_seen_owner_rw') THEN
    CREATE POLICY activity_seen_owner_rw ON activity_seen
      USING (user_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friendships' AND policyname = 'friendships_participant_rw') THEN
    CREATE POLICY friendships_participant_rw ON friendships
      USING (user_id = app.current_user_id() OR friend_id = app.current_user_id())
      WITH CHECK (user_id = app.current_user_id() OR friend_id = app.current_user_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shares_inbox' AND policyname = 'shares_inbox_participant_rw') THEN
    CREATE POLICY shares_inbox_participant_rw ON shares_inbox
      USING (sender_id = app.current_user_id() OR receiver_id = app.current_user_id())
      WITH CHECK (sender_id = app.current_user_id() OR receiver_id = app.current_user_id());
  END IF;
END $$;
