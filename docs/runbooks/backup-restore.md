# Backup and Restore

## Backup contract

Hourly maintenance reconciles projections, expires capabilities, runs repository validation, verifies signatures, and creates encrypted off-site backup material. At least daily it must produce:

- a verified `git bundle` for every household;
- a canonical, signed manifest containing pseudonymous household ID, HEAD, object count, bundle hash, schema/format version, and checkpoint time;
- a protected Neon backup or branch checkpoint for private identity mappings and operational state;
- upload confirmation from the separate Backblaze account and Object Lock compliance retention date.

The backup key is not stored with the objects. Alerts fire before backup age reaches 24 hours. Monthly restore drills target RPO at most 24 hours and RTO at most 8 hours.

## Verify a backup

1. Run the maintenance CLI's backup verification mode in an isolated work directory.
2. Verify the manifest signature before trusting any hash or HEAD.
3. Decrypt one selected bundle using a drill-only copy of the recovery key, run `git bundle verify`, restore to a bare repository, run `git fsck --full`, and verify commit signatures.
4. Compare restored HEAD, object count, bundle hash, and `FORMAT_VERSION` to the signed manifest.
5. Confirm the matching operational checkpoint can restore into a new isolated Neon branch and that projections rebuild from signed Git plus private identity mappings.
6. Destroy drill credentials and isolated data according to retention policy; retain only non-private drill evidence.

## Full restore

1. Declare an incident, stop and fence the writer, preserve primary media, and select a signed manifest before the recovery point objective.
2. Provision an isolated replacement volume and Neon branch. Do not overwrite the primary volume or database.
3. Restore operational metadata first. Keep OAuth/session tokens revoked or expired unless their encrypted state and reuse history are verified; prefer forcing reauthentication.
4. Restore each verified bundle to its UUID-derived bare path. Reject path anomalies, unsigned/invalid commits, unexpected refs, symlinks, submodules, executable files, and unsupported formats.
5. Rebuild membership/search/repository projections. Compare every projected HEAD to the signed manifest and quarantine mismatches.
6. Run the complete operator-health and cross-tenant read tests without public traffic.
7. Switch only after the prior writer is proven off and the restored writer has the correct volume marker. Follow `droplet-failover.md` for address movement.
8. Run a post-switch canary mutation, verify one signed commit and one durable mutation result, then trigger a fresh backup.

Record achieved RPO/RTO, missing or quarantined households, signature results, projection results, and approvals. Do not report a restore successful while any required verification is unresolved.

## Backblaze B2 setup

Backblaze B2 is the selected production object provider. It is [S3 compatible](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api), lives outside the DigitalOcean failure domain, supports [compliance-mode Object Lock](https://www.backblaze.com/docs/cloud-storage-enable-object-lock-with-the-s3-compatible-api), and [starts at $6.95/TB/month](https://www.backblaze.com/cloud-storage/pricing) as of 2026-07-15. Provider choice remains behind `BackupPort`; changing providers requires an interoperability and retention test, not domain changes.

1. Use a Backblaze account that is not controlled by the DigitalOcean account. Create a private bucket, enable Object Lock, and set at least 35 days of default compliance retention. Object Lock cannot be disabled after it is enabled.
2. Create a bucket-restricted application key with only the read/write and retention-inspection capabilities required by the S3-compatible upload, `HeadObject`, and drill download paths. Do not grant delete capability. Record the S3 endpoint and region shown for the bucket.
3. Generate a 32-byte encryption key with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"`. Generate a separate Ed25519 manifest key pair with `openssl genpkey -algorithm ED25519` and `openssl pkey -pubout`. Store the encryption key, private signing key, and object credentials only as encrypted systemd credentials. Keep offline recovery copies outside both providers.
4. Put the endpoint, region, bucket, prefix, key identifier, and retention days in `/etc/hfj/deploy.env`. Install the five backup credentials named in `deploy/compose.yaml`, then restart the app so the maintenance container receives them.
5. Run `docker compose exec -T app npm run maintenance:backup --workspace @hfj/server`. A checkpoint is written only after B2 confirms ciphertext length/hash metadata and a compliance retention date at least as late as the requested date.
6. Run `docker compose exec -T app npm run maintenance:restore-drill --workspace @hfj/server -- <household-id>`. The command downloads into an isolated temporary directory, authenticates and decrypts both JWE objects, verifies the Ed25519 JWS manifest and hashes, restores the bundle, runs full fsck, compares HEAD/object count, and verifies every commit signature.

Hourly maintenance skips an unchanged checkpoint younger than 23 hours, so each household receives at least a daily immutable copy without creating hourly duplicates. It automatically runs a restore drill when successful evidence is absent or 30 days old. A failed second-object upload can leave an unreferenced locked first object; it cannot produce a database checkpoint or a successful health state and expires under the same retention policy.

## Neon recovery

Configure the production Neon project for at least 30 days of [point-in-time history retention](https://neon.com/blog/announcing-point-in-time-restore) and enable scheduled snapshots where the selected paid plan supports them. Before launch, create an isolated point-in-time branch, validate the operational tables and identity/OAuth constraints, rebuild projections against restored Git, and record achieved RPO/RTO. The application does not hold a Neon management API key and never attempts an in-place production restore; console/API recovery remains an explicit fenced operator action.
