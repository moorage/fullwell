#!/bin/sh
set -eu

test "${1:-}" = "--confirm-empty-volume" || { echo "usage: $0 --confirm-empty-volume" >&2; exit 2; }
mount_path=/data/households
expected_file=/etc/hfj/expected-volume-id

mountpoint -q "$mount_path" || { echo "$mount_path is not mounted" >&2; exit 1; }
test -r "$expected_file" || { echo "missing expected volume identity" >&2; exit 1; }
test -z "$(find "$mount_path" -mindepth 1 -maxdepth 1 -print -quit)" || { echo "refusing to initialize a non-empty volume" >&2; exit 1; }
chown 10001:10001 "$mount_path"
chmod 0750 "$mount_path"
install -d -m 0750 -o 10001 -g 10001 "$mount_path/.worktrees" "$mount_path/.exports"
install -m 0440 -o 10001 -g 10001 "$expected_file" "$mount_path/.hfj-volume-id"
sync -f "$mount_path"
