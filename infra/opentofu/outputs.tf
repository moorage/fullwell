output "droplet_id" {
  value       = digitalocean_droplet.app.id
  description = "Active single-writer Droplet ID."
}

output "reserved_ip" {
  value       = digitalocean_reserved_ip.app.ip_address
  description = "Reserved public address to move during fenced failover."
}

output "household_volume_id" {
  value       = digitalocean_volume.households.id
  description = "Identity written to /etc/hfj/expected-volume-id and the initialized volume marker."
}

output "managed_fqdn" {
  value       = var.dns_zone == "" ? null : "${var.dns_record}.${var.dns_zone}"
  description = "FQDN when the optional DigitalOcean DNS record is enabled."
}
