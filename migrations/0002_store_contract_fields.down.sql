BEGIN;

ALTER TABLE family_invitations
  DROP COLUMN intended_email_hint;

ALTER TABLE web_sessions
  DROP CONSTRAINT web_sessions_scopes_check,
  DROP COLUMN client,
  DROP COLUMN scopes;

COMMIT;
