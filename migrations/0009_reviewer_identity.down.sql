BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM external_identities WHERE provider = 'reviewer') THEN
    RAISE EXCEPTION 'remove reviewer identities before reverting migration 0009';
  END IF;
END
$$;

ALTER TABLE external_identities
  DROP CONSTRAINT external_identities_provider_check,
  ADD CONSTRAINT external_identities_provider_check
    CHECK (provider IN ('apple', 'magic_link', 'passkey'));

COMMIT;
