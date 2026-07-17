# DigitalOcean OpenTofu

This stack provisions one fenced writer Droplet, one attached ext4 Block Storage volume, one reserved IP, a restricted Cloud Firewall, and an optional DNS record. It does not provision Neon or store any application secret.

## Staging cost baseline

The reviewed staging defaults are a 1 GiB Basic Droplet (`s-1vcpu-1gb`), a 50 GiB Block Storage volume, and weekly Droplet backups. At DigitalOcean's prices verified on 2026-07-17, those components cost $6.00, $5.00, and $1.20 per month respectively, or $12.20 per month before tax. See the official [Droplet](https://www.digitalocean.com/pricing/droplets), [volume](https://docs.digitalocean.com/products/volumes/details/pricing/), and [backup](https://docs.digitalocean.com/products/backups/details/pricing/) pricing pages.

Cloud-init creates a 2 GiB swap file with low swappiness to absorb transient container-startup and Git-maintenance pressure on the 1 GiB host. Build the OCI image off-host; the staging Droplet is a runtime target, not an image builder. Monitor memory, swap, latency, and maintenance duration during staging. Resize the Droplet before production or when load evidence shows sustained memory pressure. Production must set an explicitly reviewed `droplet_size` rather than inheriting the staging capacity decision.

## State and credentials

State uses OpenTofu's PostgreSQL backend in a dedicated Neon database and role. The backend holds a database advisory lock for each operation, so use a direct, TLS-enabled Neon connection rather than the pooled endpoint. Supply that URL only through `PG_CONN_STR`, and use a distinct `PG_SCHEMA_NAME` such as `hfj_digitalocean_staging_state` for each environment. The role needs access only to its state database, its configured schema, and the `public` schema sequence used by the backend.

Backblaze B2 remains the off-site application-backup provider, not the OpenTofu state backend. Its S3-compatible endpoint returns `501 NotImplemented` for the `If-None-Match: *` conditional write required by OpenTofu's native S3 lockfile, so it cannot provide the required state-locking contract.

Supply the DigitalOcean API token only through `DIGITALOCEAN_TOKEN`; never put it or the Neon URL in a `.tfvars` file or commit either value. OpenTofu outputs contain infrastructure identifiers, not runtime credentials.

## Apply

```sh
read -rs PG_CONN_STR
export PG_CONN_STR
export PG_SCHEMA_NAME='hfj_digitalocean_staging_state'
tofu init
tofu plan -var-file=staging.tfvars -out=staging.tfplan
tofu apply staging.tfplan
```

Record `household_volume_id`, write it to `/etc/hfj/expected-volume-id` on the host, start `data-households.mount`, and initialize a confirmed-empty volume with `deploy/scripts/initialize-volume.sh --confirm-empty-volume`. The service fails closed until the marker matches.

Never destroy the volume during ordinary replacement. The resource has `prevent_destroy`; failover reattaches the existing volume after the prior writer is fenced.
