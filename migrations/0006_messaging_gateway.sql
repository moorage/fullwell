BEGIN;

ALTER TABLE web_sessions DROP CONSTRAINT web_sessions_scopes_check;
ALTER TABLE web_sessions
  ADD CONSTRAINT web_sessions_scopes_check
  CHECK (
    cardinality(scopes) > 0
    AND scopes <@ ARRAY[
      'journal:read', 'journal:write', 'household:manage', 'collection:share',
      'journal:export', 'runner:messages'
    ]::text[]
  );

CREATE TABLE runner_devices (
  id text PRIMARY KEY CHECK (id ~ '^dev_[0-9a-z]{16,64}$'),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX runner_devices_active_primary_idx
  ON runner_devices(user_id, household_id) WHERE revoked_at IS NULL;

CREATE TABLE provider_identity_links (
  id text PRIMARY KEY CHECK (id ~ '^lnk_[0-9a-z]{16,64}$'),
  provider text NOT NULL CHECK (provider = 'whatsapp_cloud'),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  runner_device_id text NOT NULL REFERENCES runner_devices(id) ON DELETE RESTRICT,
  provider_identity_hash text NOT NULL CHECK (provider_identity_hash ~ '^[0-9a-f]{64}$'),
  destination_ciphertext text NOT NULL CHECK (length(destination_ciphertext) BETWEEN 32 AND 4096),
  browser_binding_hash text CHECK (browser_binding_hash IS NULL OR browser_binding_hash ~ '^[0-9a-f]{64}$'),
  confirmation_expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  linked_at timestamptz NOT NULL,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (confirmed_at IS NULL AND browser_binding_hash IS NOT NULL)
    OR (confirmed_at IS NOT NULL AND browser_binding_hash IS NULL AND confirmed_at <= confirmation_expires_at)
  )
);
CREATE UNIQUE INDEX provider_identity_links_active_identity_idx
  ON provider_identity_links(provider, provider_identity_hash) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX provider_identity_links_active_user_idx
  ON provider_identity_links(provider, user_id) WHERE revoked_at IS NULL;

CREATE TABLE provider_link_challenges (
  id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'whatsapp_cloud'),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  runner_device_id text NOT NULL REFERENCES runner_devices(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  browser_binding_hash text NOT NULL CHECK (browser_binding_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_link_challenges_expiry_idx
  ON provider_link_challenges(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE message_envelopes (
  id text PRIMARY KEY CHECK (id ~ '^msg_[0-9a-z]{16,64}$'),
  request_id text NOT NULL UNIQUE CHECK (request_id ~ '^req_[0-9a-z]{16,64}$'),
  provider_link_id text NOT NULL REFERENCES provider_identity_links(id) ON DELETE RESTRICT,
  provider_message_hash text NOT NULL UNIQUE CHECK (provider_message_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN (
    'received', 'queued', 'leased', 'awaiting_user', 'response_ready',
    'response_sent', 'completed', 'expired', 'failed'
  )),
  inbound_ciphertext text NOT NULL CHECK (length(inbound_ciphertext) BETWEEN 32 AND 8192),
  response_ciphertext text CHECK (response_ciphertext IS NULL OR length(response_ciphertext) BETWEEN 32 AND 8192),
  host_session_ciphertext text CHECK (host_session_ciphertext IS NULL OR length(host_session_ciphertext) BETWEEN 32 AND 4096),
  terminal_kind text CHECK (terminal_kind IS NULL OR terminal_kind IN ('completed', 'needs_input', 'blocked', 'cancelled')),
  received_at timestamptz NOT NULL,
  service_window_expires_at timestamptz NOT NULL,
  lease_id text CHECK (lease_id IS NULL OR lease_id ~ '^lse_[0-9a-z]{16,64}$'),
  lease_device_id text REFERENCES runner_devices(id) ON DELETE RESTRICT,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  failure_code text CHECK (failure_code IS NULL OR length(failure_code) BETWEEN 1 AND 64),
  response_sent_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (service_window_expires_at <= expires_at),
  CHECK (
    (state = 'leased' AND lease_id IS NOT NULL AND lease_device_id IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (state <> 'leased' AND lease_id IS NULL AND lease_device_id IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK (
    (state IN ('response_ready', 'response_sent', 'completed', 'awaiting_user') AND terminal_kind IS NOT NULL)
    OR (state NOT IN ('response_ready', 'response_sent', 'completed', 'awaiting_user') AND terminal_kind IS NULL)
  ),
  CHECK (state <> 'response_ready' OR response_ciphertext IS NOT NULL),
  CHECK (state <> 'awaiting_user' OR terminal_kind = 'needs_input'),
  CHECK (state NOT IN ('response_sent', 'completed', 'awaiting_user') OR response_sent_at IS NOT NULL)
);
CREATE INDEX message_envelopes_claim_idx
  ON message_envelopes(provider_link_id, received_at, id) WHERE state = 'queued';
CREATE INDEX message_envelopes_lease_expiry_idx
  ON message_envelopes(lease_expires_at) WHERE state = 'leased';
CREATE INDEX message_envelopes_retention_idx ON message_envelopes(expires_at);

CREATE TABLE message_provider_events (
  provider_message_hash text PRIMARY KEY CHECK (provider_message_hash ~ '^[0-9a-f]{64}$'),
  message_envelope_id text NOT NULL REFERENCES message_envelopes(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_provider_events_envelope_idx
  ON message_provider_events(message_envelope_id, occurred_at);

CREATE TABLE message_delivery_receipts (
  id text PRIMARY KEY,
  message_envelope_id text NOT NULL REFERENCES message_envelopes(id) ON DELETE CASCADE,
  provider_delivery_hash text NOT NULL UNIQUE CHECK (provider_delivery_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('accepted', 'sent', 'delivered', 'read', 'failed')),
  occurred_at timestamptz NOT NULL,
  failure_code text CHECK (failure_code IS NULL OR length(failure_code) BETWEEN 1 AND 64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_delivery_receipts_envelope_idx
  ON message_delivery_receipts(message_envelope_id, occurred_at);

COMMIT;
