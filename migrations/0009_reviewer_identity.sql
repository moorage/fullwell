BEGIN;

ALTER TABLE external_identities
  DROP CONSTRAINT external_identities_provider_check,
  ADD CONSTRAINT external_identities_provider_check
    CHECK (provider IN ('apple', 'magic_link', 'passkey', 'reviewer'));

COMMIT;
