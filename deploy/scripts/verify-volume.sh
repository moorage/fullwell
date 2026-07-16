#!/bin/sh
set -eu

mount_path=/data/households
expected_file=/etc/hfj/expected-volume-id
marker_file=$mount_path/.hfj-volume-id

test -r "$expected_file" || { echo "missing expected volume identity" >&2; exit 1; }
mountpoint -q "$mount_path" || { echo "$mount_path is not a mount point" >&2; exit 1; }
findmnt -n -o OPTIONS "$mount_path" | tr ',' '\n' | grep -qx rw || { echo "$mount_path is not read-write" >&2; exit 1; }
test -r "$marker_file" || { echo "volume is not initialized" >&2; exit 1; }
test "$(cat "$expected_file")" = "$(cat "$marker_file")" || { echo "mounted volume identity differs from expected" >&2; exit 1; }
test -d "$mount_path/.worktrees" || { echo "worktree directory is missing" >&2; exit 1; }
test -w "$mount_path" || { echo "$mount_path is not writable by the service account" >&2; exit 1; }
