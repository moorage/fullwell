BEGIN;

ALTER TABLE export_downloads DROP CONSTRAINT export_downloads_format_check;
UPDATE export_downloads SET format = 'readable_zip' WHERE format = 'zip';
ALTER TABLE export_downloads ADD CONSTRAINT export_downloads_format_check CHECK (format IN ('readable_zip', 'git_bundle'));
-- Pre-migration links are short-lived placeholders without a verifiable artifact hash or source HEAD.
DELETE FROM export_downloads;
ALTER TABLE export_downloads
  ADD COLUMN content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN repository_head text NOT NULL CHECK (repository_head ~ '^[0-9a-f]{40,64}$');

COMMIT;
