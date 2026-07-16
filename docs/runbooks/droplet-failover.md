# Droplet Failover

This is a single-writer failover. Block Storage and the reserved IP must never be attached to a writable replacement while the prior app can still write.

## Fence the old writer

1. Stop `household-food-journal.service` and confirm its app container is absent. If the host is unreachable, power it off through a separately authenticated DigitalOcean operator session.
2. Confirm from the DigitalOcean control plane that the old Droplet is powered off. A network firewall alone is not sufficient fencing.
3. Record the last known repository HEADs, mutation states, backup checkpoint, and reserved-IP assignment. Mark in-flight mutations for reconciliation.
4. Detach the household volume only after fencing is independently verified by two operators for production.

## Activate the replacement

1. Provision the replacement from the reviewed OpenTofu plan without creating a new household volume.
2. Attach the existing volume, start `data-households.mount`, and compare its `.hfj-volume-id` to `/etc/hfj/expected-volume-id`.
3. Install the same or reviewed replacement encrypted credentials. Verify the image by immutable digest.
4. Run read-only `git fsck`, signature, format, manifest, Neon schema, projection, and incomplete-mutation checks. Quarantine any mismatch.
5. Start the service without moving the reserved IP. Run local readiness and one canary read.
6. Move the reserved IP to the replacement only after readiness is green. Update external DNS only when it does not already target the reserved IP.
7. Run install, OAuth metadata, MCP, public collection, revocation, and canary mutation smokes. Confirm the canary produces exactly one signed commit and survives a container restart.
8. Trigger reconciliation and an off-site backup, then monitor lock waits, conflicts, incomplete mutations, signatures, volume capacity, and backup age.

Do not power the old Droplet back on while it retains deploy credentials. Remove or rotate its encrypted credential files and delete it only after incident evidence is preserved.
