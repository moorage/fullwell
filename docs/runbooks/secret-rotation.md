# Secret Rotation

Runtime secrets are separate encrypted systemd credentials. Plaintext is accepted only through a root-owned interactive channel, materialized by systemd under `/run/credentials`, and mounted read-only into the app. It never enters images, OpenTofu, logs, Git, the Block Storage volume, or shell history.

## General procedure

1. Identify consumers, overlap requirements, revocation semantics, and a verified rollback value.
2. Create the replacement in the upstream provider with least privilege. Do not revoke the old value yet when overlap is required.
3. Encrypt from standard input using `systemd-creds encrypt --name=<unit-credential-name> - <temporary-encrypted-path>`.
4. Verify owner `root`, mode `0600`, encrypted header, and expected credential name. Atomically replace the matching file under `/etc/credstore.encrypted`.
5. Reload or restart the single writer. Confirm readiness and a narrowly scoped operation without printing the value.
6. Revoke the old value at the provider, test that it no longer works, and monitor authentication and maintenance failures.
7. Record only credential purpose, version/fingerprint, operators, timestamps, test result, and next rotation date.

## Purpose-specific rules

- Database: rotate pooled and direct roles independently. The runtime role cannot migrate; the direct role is unavailable to normal request paths.
- OAuth/cookie/encryption: deploy a bounded verify-old/sign-new key ring, wait beyond maximum token/session lifetime, then remove the old key. Refresh-token reuse history remains intact.
- HMAC peppers: retain prior verification pepper only for the documented capability lifetime, sign new tokens with the new pepper, and revoke old links if compromise is suspected.
- Apple: install the new key and verify authorization-code exchange before revoking the old key in Apple Developer.
- Resend: restrict the API key to the production sender, verify a safe test message, then revoke the old key.
- Operator: replace the encrypted `operator-token` credential, reload the app, prove the old token receives `401`, and verify the new token can read only `/health/operator` and `/metrics`; it must never authenticate MCP or household routes.
- Git signing: follow `signing-key-recovery.md`; historical signatures must remain verifiable after rotation.
- Backup: rotate AWS access values and age recipient separately. Never remove the only key able to decrypt retained backups before re-encryption or expiry is verified.
- DigitalOcean: the infrastructure operator token is not loaded into the app. Rotate it in the operator secret store and test a read-only plan first.

For suspected compromise, fence the affected function, revoke first where safety requires, invalidate dependent grants/capabilities, and use recovery credentials. Do not keep serving with an unknown signing, encryption, or database identity.
