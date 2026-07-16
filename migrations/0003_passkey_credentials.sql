BEGIN;

CREATE TABLE passkey_credentials (
  credential_id text PRIMARY KEY
    CHECK (length(credential_id) BETWEEN 1 AND 2048 AND credential_id ~ '^[A-Za-z0-9_-]+$'),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key bytea NOT NULL CHECK (octet_length(public_key) BETWEEN 16 AND 4096),
  counter bigint NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (transports <@ ARRAY['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']::text[]),
  device_type text NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up boolean NOT NULL,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX passkey_credentials_user_active_idx
  ON passkey_credentials(user_id, created_at)
  WHERE revoked_at IS NULL;

COMMIT;
