# DigitalOcean OpenTofu

This stack provisions one fenced writer Droplet, one attached ext4 Block Storage volume, one reserved IP, a restricted Cloud Firewall, and an optional DNS record. It does not provision Neon or store any application secret.

## State and credentials

Use an encrypted remote state backend with locking and a separately controlled operator account. Supply the DigitalOcean API token only through `DIGITALOCEAN_TOKEN`; never put it in a `.tfvars` file or commit it. OpenTofu outputs contain infrastructure identifiers, not runtime credentials.

## Apply

```sh
tofu init
tofu plan -var-file=staging.tfvars -out=staging.plan
tofu apply staging.plan
```

Record `household_volume_id`, write it to `/etc/hfj/expected-volume-id` on the host, start `data-households.mount`, and initialize a confirmed-empty volume with `deploy/scripts/initialize-volume.sh --confirm-empty-volume`. The service fails closed until the marker matches.

Never destroy the volume during ordinary replacement. The resource has `prevent_destroy`; failover reattaches the existing volume after the prior writer is fenced.
