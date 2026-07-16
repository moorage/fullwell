BEGIN;

ALTER TABLE web_sessions
  ADD COLUMN scopes text[] NOT NULL DEFAULT ARRAY['journal:read']::text[],
  ADD COLUMN client text NOT NULL DEFAULT 'web'
    CHECK (client IN ('web', 'codex', 'claude', 'test'));

ALTER TABLE web_sessions
  ADD CONSTRAINT web_sessions_scopes_check
  CHECK (
    cardinality(scopes) > 0
    AND scopes <@ ARRAY[
      'journal:read',
      'journal:write',
      'household:manage',
      'collection:share',
      'journal:export'
    ]::text[]
  );

ALTER TABLE family_invitations
  ADD COLUMN intended_email_hint text
  CHECK (intended_email_hint IS NULL OR length(intended_email_hint) BETWEEN 1 AND 320);

COMMIT;
