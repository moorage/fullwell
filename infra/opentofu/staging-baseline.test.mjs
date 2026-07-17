import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readStackFile = (name) =>
  readFile(new URL(name, import.meta.url), "utf8");

test("keeps the reviewed lean staging capacity and recovery baseline", async () => {
  const [variables, main, cloudInit] = await Promise.all([
    readStackFile("variables.tf"),
    readStackFile("main.tf"),
    readStackFile("cloud-init.yaml.tftpl"),
  ]);

  assert.match(
    variables,
    /variable "droplet_size"[\s\S]*?default\s+=\s+"s-1vcpu-1gb"/,
  );
  assert.match(variables, /variable "volume_size_gib"[\s\S]*?default\s+=\s+50/);
  assert.match(main, /backups\s+=\s+true/);
  assert.match(cloudInit, /What=\/swapfile/);
  assert.match(cloudInit, /\[fallocate, -l, 2G, \/swapfile\]/);
  assert.match(cloudInit, /\[systemctl, enable, --now, swapfile\.swap\]/);
  assert.match(cloudInit, /vm\.swappiness=10/);
});
