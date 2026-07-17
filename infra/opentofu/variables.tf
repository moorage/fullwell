variable "environment" {
  description = "Deployment environment name."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "region" {
  description = "DigitalOcean region for the Droplet and volume."
  type        = string
  default     = "sfo3"
}

variable "droplet_size" {
  description = "DigitalOcean Droplet size slug. The default is the reviewed staging baseline; production must set an explicitly reviewed size."
  type        = string
  default     = "s-1vcpu-1gb"
}

variable "droplet_image" {
  description = "Pinned or reviewed Ubuntu image slug."
  type        = string
  default     = "ubuntu-24-04-x64"
}

variable "volume_size_gib" {
  description = "Authoritative household repository volume size in GiB. The default is the reviewed staging baseline."
  type        = number
  default     = 50

  validation {
    condition     = var.volume_size_gib >= 10
    error_message = "volume_size_gib must be at least 10"
  }
}

variable "ssh_key_fingerprints" {
  description = "Pre-provisioned operator SSH-key fingerprints."
  type        = set(string)

  validation {
    condition     = length(var.ssh_key_fingerprints) > 0
    error_message = "at least one operator SSH key is required"
  }
}

variable "operator_cidrs" {
  description = "Networks permitted to reach SSH. Never use 0.0.0.0/0."
  type        = set(string)

  validation {
    condition = length(var.operator_cidrs) > 0 && alltrue([
      for cidr in var.operator_cidrs : !contains(["0.0.0.0/0", "::/0"], cidr)
    ])
    error_message = "operator_cidrs must be non-empty and may not allow the entire internet"
  }
}

variable "dns_zone" {
  description = "Existing DigitalOcean DNS zone. Leave empty to manage DNS elsewhere."
  type        = string
  default     = ""
}

variable "dns_record" {
  description = "DNS record name within dns_zone."
  type        = string
  default     = "journal"
}
