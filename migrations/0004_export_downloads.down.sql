BEGIN;

ALTER TABLE export_downloads DROP CONSTRAINT export_downloads_format_check;
UPDATE export_downloads SET format = 'zip' WHERE format = 'readable_zip';
ALTER TABLE export_downloads ADD CONSTRAINT export_downloads_format_check CHECK (format IN ('zip', 'git_bundle'));
ALTER TABLE export_downloads DROP COLUMN repository_head, DROP COLUMN content_hash;

COMMIT;
