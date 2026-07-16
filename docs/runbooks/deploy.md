# Deploy Household Food Journal

## Preconditions

- A reviewed image exists by immutable digest and passed build, test, security, restore, and browser gates.
- The direct and pooled Neon URLs address the intended staging or production project and branch.
- DNS, Apple Services ID, passkey RP ID, OAuth issuer/resource, email sender, and object-storage origin exactly match the public domain.
- An encrypted, locked OpenTofu backend is configured. `DIGITALOCEAN_TOKEN` is supplied only to the operator process.
- The release has a rollback digest. Database migration up/down/up was rehearsed on an isolated Neon branch.
- The off-site AWS S3 bucket uses encryption, versioning, Object Lock, and credentials held separately from DigitalOcean.

## Provision

1. In `infra/opentofu`, run `tofu init`, `tofu fmt -check`, `tofu validate`, and a saved `tofu plan` with reviewed environment inputs.
2. Apply the saved plan. Record the Droplet ID, reserved IP, and household volume ID in the restricted deployment record.
3. Confirm the Cloud Firewall exposes only operator-scoped SSH plus public 80/443. Confirm Droplet monitoring and backups are enabled.
4. Copy the release tree to `/opt/household-food-journal` without credentials. Install the units from `deploy/systemd/` and run `systemctl daemon-reload`.
5. Write the OpenTofu volume ID plus a newline to root-owned `/etc/hfj/expected-volume-id` with mode `0440`.
6. Start `data-households.mount`. Verify `findmnt /data/households` reports the labeled ext4 Block Storage device, not the root disk.
7. For a new confirmed-empty volume only, run `deploy/scripts/initialize-volume.sh --confirm-empty-volume`. Never run initialization on a restored or previously used volume.

## Install encrypted credentials

Use `systemd-creds encrypt --name=<credential-name> - /etc/credstore.encrypted/<file>` from a root-only interactive session. The plaintext is read from standard input and must not enter shell history or a repository. Install one encrypted file for each `LoadCredentialEncrypted` entry in the service units:

- pooled Neon URL and separate direct migration URL;
- application signing, cookie, OAuth, HMAC-pepper, and encryption key set;
- Apple private key;
- Postmark server token;
- Git SSH signing private key;
- age backup private key;
- AWS S3 backup endpoint, bucket, region, and narrowly scoped access values.

Put only `PUBLIC_DOMAIN` and the immutable `HFJ_IMAGE` digest in `/etc/hfj/deploy.env`, root-owned mode `0440`. No credential belongs in that file, the image, OpenTofu state, `/opt`, or `/data/households`.

## Release

1. Run `deploy/scripts/verify-volume.sh` and `docker compose config --quiet` from `deploy/` under the service credential context.
2. Pull the digest-pinned app and gateway images.
3. Run the release migration command as an explicit one-shot operation using the direct Neon credential. Do not let application startup apply migrations.
4. Start `household-food-journal.service`. Enable and start `household-food-journal-maintenance.timer` only after readiness is green.
5. Verify `/health/live`, `/health/ready`, and authenticated operator health. Readiness must include schema version, pooled Neon, expected mount identity/capacity, Git executable/signing, repository validity, incomplete mutation count, reconciliation lag, and backup age.
6. Run non-destructive install, OAuth metadata, MCP health, public-policy, canary repository, container-restart persistence, and log-redaction smoke tests.
7. Confirm the canary commit exists after container restart and that no token, email, title, food name, order ID, source URL, or body appears in logs.

Keep one active writer. Do not add another app replica, expose Git, or move repositories to the root disk.
