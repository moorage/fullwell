BEGIN;

DROP TABLE IF EXISTS restore_drill_checkpoints;
DROP TABLE IF EXISTS repository_verification_checkpoints;
ALTER TABLE backup_checkpoints
  DROP COLUMN IF EXISTS retained_until,
  DROP COLUMN IF EXISTS manifest_object_key,
  DROP COLUMN IF EXISTS bundle_hash;

COMMIT;
