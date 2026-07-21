BEGIN;

CREATE TABLE onboarding_preferences (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('snacks', 'recipes')),
  status text NOT NULL CHECK (status IN ('in_progress', 'skipped')),
  skip_reason text CHECK (skip_reason IN ('not_now', 'no_sources', 'user_declined')),
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, household_id, section),
  CHECK (
    (status = 'in_progress' AND skip_reason IS NULL)
    OR (status = 'skipped' AND skip_reason IS NOT NULL)
  )
);

COMMIT;
