BEGIN;

ALTER TABLE backup_checkpoints
  ADD COLUMN bundle_hash text,
  ADD COLUMN manifest_object_key text,
  ADD COLUMN retained_until timestamptz;

CREATE TABLE repository_verification_checkpoints (
  household_id text PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  repository_head text NOT NULL CHECK (repository_head ~ '^[0-9a-f]{40,64}$'),
  fsck_valid boolean NOT NULL,
  signatures_valid boolean NOT NULL,
  checked_at timestamptz NOT NULL,
  detail_code text NOT NULL
);

CREATE TABLE restore_drill_checkpoints (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  repository_head text NOT NULL CHECK (repository_head ~ '^[0-9a-f]{40,64}$'),
  succeeded boolean NOT NULL,
  completed_at timestamptz NOT NULL,
  detail_code text NOT NULL
);

COMMIT;
