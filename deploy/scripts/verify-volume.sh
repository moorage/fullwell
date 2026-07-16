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
test -d "$mount_path/.exports" || { echo "export directory is missing" >&2; exit 1; }
test "$(stat -c %u:%g "$mount_path")" = "10001:10001" || { echo "$mount_path is not owned by the service account" >&2; exit 1; }
test "$(stat -c %u:%g "$mount_path/.worktrees")" = "10001:10001" || { echo "worktree directory is not owned by the service account" >&2; exit 1; }
test "$(stat -c %u:%g "$mount_path/.exports")" = "10001:10001" || { echo "export directory is not owned by the service account" >&2; exit 1; }
