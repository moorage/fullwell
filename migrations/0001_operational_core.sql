BEGIN;

CREATE TABLE users (
  id text PRIMARY KEY CHECK (id ~ '^usr_[0-9a-z]{16,64}$'),
  actor_id text NOT NULL UNIQUE CHECK (actor_id ~ '^act_[0-9a-z]{16,64}$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  email_ciphertext bytea,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_identities (
  provider text NOT NULL CHECK (provider IN ('apple', 'magic_link', 'passkey')),
  provider_subject_hash text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_subject_hash)
);

CREATE TABLE households (
  id text PRIMARY KEY CHECK (id ~ '^hsh_[0-9a-z]{16,64}$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  repository_path text NOT NULL UNIQUE,
  repository_head text NOT NULL CHECK (repository_head ~ '^[0-9a-f]{40,64}$'),
  provisioning_state text NOT NULL CHECK (provisioning_state IN ('ready', 'failed', 'quarantined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_id text NOT NULL CHECK (actor_id ~ '^act_[0-9a-z]{16,64}$'),
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  projection_head text NOT NULL CHECK (projection_head ~ '^[0-9a-f]{40,64}$'),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
CREATE INDEX memberships_user_active_idx ON memberships(user_id, household_id) WHERE removed_at IS NULL;

CREATE TABLE user_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_household_id text REFERENCES households(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE web_sessions (
  id text PRIMARY KEY CHECK (id ~ '^ses_[0-9a-z]{16,64}$'),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  pending_intent jsonb,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX web_sessions_expiry_idx ON web_sessions(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE auth_challenges (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('magic_link', 'webauthn_registration', 'webauthn_authentication', 'apple')),
  token_hash text NOT NULL UNIQUE,
  browser_binding_hash text,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_challenges_expiry_idx ON auth_challenges(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE oauth_clients (
  client_id text PRIMARY KEY,
  metadata jsonb NOT NULL,
  redirect_uris text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_grants (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  scopes text[] NOT NULL,
  resource text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_tokens (
  id text PRIMARY KEY,
  grant_id text NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  token_kind text NOT NULL CHECK (token_kind IN ('authorization_code', 'access', 'refresh')),
  token_hash text NOT NULL UNIQUE,
  family_id text,
  parent_id text REFERENCES oauth_tokens(id) ON DELETE SET NULL,
  pkce_challenge text,
  redirect_uri text,
  audience text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX oauth_tokens_expiry_idx ON oauth_tokens(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX oauth_tokens_family_idx ON oauth_tokens(family_id) WHERE token_kind = 'refresh';

CREATE TABLE family_invitations (
  id text PRIMARY KEY CHECK (id ~ '^inv_[0-9a-z]{16,64}$'),
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  intended_email_ciphertext bytea,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX family_invitations_active_idx ON family_invitations(household_id, expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE collection_shares (
  id text PRIMARY KEY CHECK (id ~ '^shr_[0-9a-z]{16,64}$'),
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  collection_id text NOT NULL CHECK (collection_id ~ '^col_[0-9a-z]{16,64}$'),
  token_hash text NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collection_shares_active_idx ON collection_shares(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE mutation_requests (
  request_id text PRIMARY KEY CHECK (request_id ~ '^req_[0-9a-z]{16,64}$'),
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  household_id text REFERENCES households(id) ON DELETE RESTRICT,
  tool_name text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  state text NOT NULL CHECK (state IN ('received', 'locked', 'git_committed', 'projections_applied', 'completed', 'failed_before_commit', 'reconciliation_required', 'quarantined')),
  commit_id text CHECK (commit_id IS NULL OR commit_id ~ '^[0-9a-f]{40,64}$'),
  response jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tool_name, idempotency_key)
);
CREATE INDEX mutation_requests_reconcile_idx ON mutation_requests(updated_at) WHERE state IN ('git_committed', 'reconciliation_required');

CREATE TABLE journal_projections (
  household_id text PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  repository_head text NOT NULL CHECK (repository_head ~ '^[0-9a-f]{40,64}$'),
  projection jsonb NOT NULL DEFAULT '{"evidence":{},"items":{},"profiles":{},"collections":{}}'::jsonb,
  rebuilt_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE search_items (
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_id text NOT NULL CHECK (item_id ~ '^itm_[0-9a-z]{16,64}$'),
  kind text NOT NULL CHECK (kind IN ('snack', 'recipe')),
  repository_revision text NOT NULL CHECK (repository_revision ~ '^[0-9a-f]{40,64}$'),
  distinguishing_fields jsonb NOT NULL,
  search_document tsvector NOT NULL,
  PRIMARY KEY (household_id, item_id)
);
CREATE INDEX search_items_document_idx ON search_items USING gin(search_document);

CREATE TABLE jobs (
  id text PRIMARY KEY,
  kind text NOT NULL,
  household_id text REFERENCES households(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL CHECK (state IN ('pending', 'running', 'completed', 'failed', 'quarantined')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_pending_idx ON jobs(run_after, id) WHERE state = 'pending';

CREATE TABLE backup_checkpoints (
  household_id text PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  repository_head text NOT NULL CHECK (repository_head ~ '^[0-9a-f]{40,64}$'),
  manifest_hash text NOT NULL,
  object_key text NOT NULL,
  completed_at timestamptz NOT NULL,
  verified_at timestamptz
);

CREATE TABLE export_downloads (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  requested_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('zip', 'git_bundle')),
  token_hash text NOT NULL UNIQUE,
  object_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
