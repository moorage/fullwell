# Backup and Restore

## Backup contract

Hourly maintenance reconciles projections, expires capabilities, runs repository validation, verifies signatures, and creates encrypted off-site backup material. At least daily it must produce:

- a verified `git bundle` for every household;
- a canonical, signed manifest containing pseudonymous household ID, HEAD, object count, bundle hash, schema/format version, and checkpoint time;
- a protected Neon backup or branch checkpoint for private identity mappings and operational state;
- upload confirmation from the separate AWS account and Object Lock retention date.

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
