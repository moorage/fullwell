BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM message_envelopes)
    OR EXISTS (SELECT 1 FROM provider_identity_links)
    OR EXISTS (SELECT 1 FROM provider_link_challenges)
    OR EXISTS (SELECT 1 FROM runner_devices)
  THEN
    RAISE EXCEPTION 'refusing to remove messaging schema until every envelope, link, challenge, and runner device is drained';
  END IF;
END $$;

DROP TABLE message_delivery_receipts;
DROP TABLE message_provider_events;
DROP TABLE message_envelopes;
DROP TABLE provider_link_challenges;
DROP TABLE provider_identity_links;
DROP TABLE runner_devices;

ALTER TABLE web_sessions DROP CONSTRAINT web_sessions_scopes_check;
ALTER TABLE web_sessions
  ADD CONSTRAINT web_sessions_scopes_check
  CHECK (
    cardinality(scopes) > 0
    AND scopes <@ ARRAY[
      'journal:read', 'journal:write', 'household:manage', 'collection:share',
      'journal:export'
    ]::text[]
  );

COMMIT;
