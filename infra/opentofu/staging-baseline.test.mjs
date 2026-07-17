import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readStackFile = (name) =>
  readFile(new URL(name, import.meta.url), "utf8");

test("keeps the reviewed lean staging capacity and recovery baseline", async () => {
  const [variables, main, cloudInit, initializeVolume] = await Promise.all([
    readStackFile("variables.tf"),
    readStackFile("main.tf"),
    readStackFile("cloud-init.yaml.tftpl"),
    readFile(
      new URL("../../deploy/scripts/initialize-volume.sh", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    variables,
    /variable "droplet_size"[\s\S]*?default\s+=\s+"s-1vcpu-1gb"/,
  );
  assert.match(variables, /variable "volume_size_gib"[\s\S]*?default\s+=\s+50/);
  assert.match(main, /backups\s+=\s+true/);
  assert.match(
    main,
    /backup_policy\s+\{[\s\S]*?plan\s+=\s+"weekly"[\s\S]*?weekday\s+=\s+"SUN"[\s\S]*?hour\s+=\s+4[\s\S]*?\}/,
  );
  assert.match(main, /ignore_changes\s+=\s+\[backups, user_data\]/);
  assert.match(main, /initial_filesystem_label\s+=\s+local\.volume_label/);
  assert.match(main, /volume_label\s+=\s+local\.volume_label/);
  assert.doesNotMatch(
    main,
    /volume_label\s+=\s+digitalocean_volume\.households\.filesystem_label/,
  );
  assert.match(
    main,
    /resource "digitalocean_reserved_ip_assignment" "app"[\s\S]*?depends_on\s+=\s+\[digitalocean_volume_attachment\.households\]/,
  );
  assert.match(
    main,
    /outbound_rule\s+\{\s*protocol\s+=\s+"tcp"\s*port_range\s+=\s+"80"/,
  );
  assert.match(
    main,
    /outbound_rule\s+\{\s*protocol\s+=\s+"tcp"\s*port_range\s+=\s+"5432"/,
  );
  assert.match(cloudInit, /What=\/swapfile/);
  assert.doesNotMatch(cloudInit, /dev-disk-by\\x2dlabel/);
  assert.match(cloudInit, /\[fallocate, -l, 2G, \/swapfile\]/);
  assert.match(cloudInit, /\[systemctl, enable, --now, swapfile\.swap\]/);
  assert.match(cloudInit, /vm\.swappiness=10/);
  assert.match(initializeVolume, /! -name lost\+found/);
  assert.match(initializeVolume, /test ! -L "\$mount_path\/lost\+found"/);
  assert.match(initializeVolume, /lost\+found must be root-owned/);
});
