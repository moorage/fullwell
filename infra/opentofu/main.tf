locals {
  name         = "hfj-${var.environment}"
  tags         = ["household-food-journal", var.environment, "single-writer"]
  volume_label = "hfj-households"
}

resource "digitalocean_volume" "households" {
  region                   = var.region
  name                     = "${local.name}-households"
  size                     = var.volume_size_gib
  description              = "Authoritative Household Food Journal Git repositories"
  initial_filesystem_type  = "ext4"
  initial_filesystem_label = local.volume_label
  tags                     = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "digitalocean_droplet" "app" {
  name       = local.name
  region     = var.region
  size       = var.droplet_size
  image      = var.droplet_image
  ssh_keys   = var.ssh_key_fingerprints
  monitoring = true
  backups    = true
  ipv6       = true
  tags       = local.tags
  backup_policy {
    plan    = "weekly"
    weekday = "SUN"
    hour    = 4
  }
  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    volume_label = local.volume_label
  })

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [backups, user_data]
  }
}

resource "digitalocean_volume_attachment" "households" {
  droplet_id = digitalocean_droplet.app.id
  volume_id  = digitalocean_volume.households.id
}

resource "digitalocean_reserved_ip" "app" {
  region = var.region
}

resource "digitalocean_reserved_ip_assignment" "app" {
  ip_address = digitalocean_reserved_ip.app.ip_address
  droplet_id = digitalocean_droplet.app.id

  depends_on = [digitalocean_volume_attachment.households]
}

resource "digitalocean_firewall" "app" {
  name        = local.name
  droplet_ids = [digitalocean_droplet.app.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.operator_cidrs
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "53"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "53"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "123"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "80"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "443"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "5432"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_record" "app" {
  count  = var.dns_zone == "" ? 0 : 1
  domain = var.dns_zone
  type   = "A"
  name   = var.dns_record
  value  = digitalocean_reserved_ip.app.ip_address
  ttl    = 300
}
