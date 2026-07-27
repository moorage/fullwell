# Deploy Household Food Journal

## Preconditions

- A reviewed image exists by immutable digest and passed build, test, security, restore, and browser gates.
- The direct and pooled Neon URLs address the intended staging or production project and branch.
- DNS, Apple Services ID, passkey RP ID, OAuth issuer/resource, email sender, and object-storage origin exactly match the canonical public domain. Any brand aliases point to the same gateway only for HTTPS termination and permanent redirect; they are not additional application origins.
- A dedicated Neon OpenTofu database and least-privilege role are reachable through a direct TLS endpoint. `PG_CONN_STR`, `PG_SCHEMA_NAME`, and `DIGITALOCEAN_TOKEN` are supplied only to the operator process.
- The release has a rollback digest. Database migration up/down/up was rehearsed on an isolated Neon branch.
- The off-site Backblaze B2 bucket is private, compliance-object-locked, encrypted before upload, and controlled through credentials held separately from DigitalOcean.

## Provision

1. In `infra/opentofu`, export the dedicated direct state URL as `PG_CONN_STR` and the environment-specific state schema as `PG_SCHEMA_NAME`, then run `tofu init`, `tofu fmt -check`, `tofu validate`, and a saved `tofu plan` with reviewed environment inputs. Never use the pooled Neon endpoint for this session-locking backend.
2. Apply the saved plan. Record the Droplet ID, reserved IP, and household volume ID in the restricted deployment record.
3. Confirm the Cloud Firewall exposes only operator-scoped SSH plus public 80/443. Confirm Droplet monitoring and backups are enabled.
4. Copy the release tree to `/opt/household-food-journal` without credentials. Install the units from `deploy/systemd/` and run `systemctl daemon-reload`.
5. Write the OpenTofu volume ID plus a newline to root-owned `/etc/hfj/expected-volume-id` with mode `0440`.
6. Start `data-households.mount`. Verify `findmnt /data/households` reports the labeled ext4 Block Storage device, not the root disk.
7. For a new confirmed-empty volume only, run `deploy/scripts/initialize-volume.sh --confirm-empty-volume`. Never run initialization on a restored or previously used volume.

Initialization assigns the volume root plus `.worktrees` and `.exports` to container UID/GID `10001` with mode `0750`. The release preflight rejects a missing directory or mismatched owner before either the application or maintenance command starts.

## Install encrypted credentials

Use `systemd-creds encrypt --name=<credential-name> - /etc/credstore.encrypted/<file>` from a root-only interactive session. The plaintext is read from standard input and must not enter shell history or a repository. Install one encrypted file for each `LoadCredentialEncrypted` entry in the service units:

- pooled Neon URL and separate direct migration URL;
- application signing, cookie, OAuth, HMAC-pepper, and encryption key set;
- a dedicated random operator bearer token of at least 32 characters for `/health/operator` and `/metrics`;
- Apple private key;
- Resend API key;
- Git SSH signing private key and matching `allowed_signers` public-key file;
- base64url backup-encryption key and Ed25519 manifest key pair;
- Backblaze B2 S3 endpoint, bucket, region, and bucket/prefix-restricted application key without `deleteFiles` or governance-bypass capability.
- WhatsApp business/phone identifiers and contact URL, Meta app secret, persistent access token, webhook verification token, and a separate 32-byte message-encryption key when the direct gateway is present.

Put only `PUBLIC_DOMAIN`, the immutable `HFJ_IMAGE` digest, and the non-secret object endpoint/region/bucket/prefix/key ID/retention settings in `/etc/hfj/deploy.env`, root-owned mode `0440`. No credential belongs in that file, the image, OpenTofu state, `/opt`, or `/data/households`.

Set `PUBLIC_DOMAIN=fullwell.ai`. Namecheap `A` records for `@` and `www`, plus the legacy host's existing record, must resolve to the Droplet's reserved public IPv4 address with no conflicting URL redirect, CNAME, or AAAA record. The final checked-in Caddyfile serves the application only at the apex and permanently redirects `www` plus `fullwell.souschefstudio.com` to the exact apex path and query.

For a live WhatsApp callback migration, first validate and activate `deploy/Caddyfile.whatsapp-cutover` while `PUBLIC_DOMAIN` remains `fullwell.souschefstudio.com`. This temporary gateway serves only `GET` and `POST /api/messaging/whatsapp/webhook` directly at the apex; every other apex request continues to redirect to the legacy application origin. Run the non-destructive messaging smoke against the apex, update and verify Meta's callback, then deploy the final Caddyfile and change `PUBLIC_DOMAIN` in the same release window. Never route a Meta webhook POST through a redirect or expose any other apex application path during this intermediate phase.

## Release

1. Run `deploy/scripts/verify-volume.sh` and `docker compose config --quiet` from `deploy/` under the service credential context.
2. Pull the digest-pinned app and gateway images.
3. Run `MIGRATION_TARGET=<staging|production> MIGRATION_EXPECTED_HOST=<exact-direct-host> npm run migrate` as an explicit one-shot operation with `DATABASE_DIRECT_URL` supplied through the service credential context. Production also requires `CONFIRM_PRODUCTION_MIGRATION=APPLY_PRODUCTION_MIGRATIONS`. The command rejects pooled endpoints, host mismatches, non-TLS connections, changed applied migrations, and concurrent ledger updates. Do not let application startup apply migrations.
4. Start `household-food-journal.service`. Enable and start `household-food-journal-maintenance.timer` only after readiness is green.
5. Verify `/health/live` and `/health/ready`, then call `/health/operator` and `/metrics` with `Authorization: Bearer <operator-token>`. Public readiness must show the release's expected schema, pooled Neon, expected mount identity/writability, Git/signing, and single-writer leadership without counts or paths. Operator health must show reconciliation age/count, quarantine count, backup gaps/age, fsck/signature failures, restore-drill freshness, messaging queue age/depth, runner-online state, and capacity; OpenMetrics must expose the matching gauges. A normal OAuth token must receive `401` with `Bearer realm="operator"`.
6. Run non-destructive install, OAuth metadata, MCP health, public-policy, canary repository, container-restart persistence, and log-redaction smoke tests.
7. Confirm the canary commit exists after container restart and that no token, email, title, food name, order ID, source URL, or body appears in logs.
8. When brand aliases are configured, verify each hostname returns a permanent redirect to the canonical host with the original path and query, then rerun the canonical deployment smoke. Do not claim alias readiness until DNS resolves to the gateway and its TLS certificate validates publicly.

The repository smoke scripts require an explicit non-local target. For staging, run:

```sh
STAGING_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- staging
STAGING_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- staging
```

After WhatsApp credentials are installed but before linking a real sender, run `npm run test:messaging-smoke` with `STAGING_BASE_URL` and the four `MESSAGING_SMOKE_*_FILE` paths. The smoke validates the challenge, rejection, and signed empty-envelope boundaries only. It does not enqueue a message or call Meta's send API.

Keep one active writer. Do not add another app replica, expose Git, or move repositories to the root disk.

For WhatsApp rollout, pin `WHATSAPP_GRAPH_API_VERSION` to the version shown as supported by the connected Meta app. Start with every `WHATSAPP_*_ENABLED` gate false. Enable webhook intake, linking, runner claims, and service replies in that order only after the prior stage passes signed staging evidence. Before claims, require the dedicated Codex project, separate keyring-backed `CODEX_HOME`, exact MCP/plugin preflight, an exact retailer-origin entry in the isolated Browser Use `browser/config.toml`, and the noninteractive fake-cart replay proof. The compiled pre-billing cutoff cannot be moved later through configuration.

The in-process limiter assumes this one-writer topology and one trusted Caddy proxy hop. Before adding replicas, move limits to a shared supported store, prove proxy-address handling, and rerun abuse/race tests. Alert on `hfj_rate_limited_total`, HTTP failure/latency, stale reconciliation, quarantines, backup gaps/age, fsck/signature failures, stale/failed restore drills, volume usage, messaging oldest-open age, queued/leased/response-ready accumulation, zero online runners with open work, cleanup failure, and blocked paid sends.
