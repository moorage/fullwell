#!/bin/sh
set -eu

source_dir=${CREDENTIALS_DIRECTORY:?systemd credential directory required}
target_dir=${DEPLOY_CREDENTIALS_DIRECTORY:?runtime credential directory required}
credential_uid=${HFJ_RUNTIME_CREDENTIAL_UID:-0}
credential_gid=${HFJ_RUNTIME_CREDENTIAL_GID:-10001}

test "$source_dir" != "$target_dir" || { echo "source and runtime credential directories must differ" >&2; exit 1; }
test -d "$target_dir" || { echo "runtime credential directory is missing" >&2; exit 1; }

for credential in \
  database-url \
  database-direct-url \
  token-pepper \
  session-secret \
  operator-token \
  apple-private-key \
  mail-provider-api-key \
  openai-review-username \
  openai-review-password \
  openai-apps-challenge \
  git-signing-key \
  git-allowed-signers \
  object-storage-access-key-id \
  object-storage-secret-access-key \
  backup-encryption-key \
  backup-manifest-private-key \
  backup-manifest-public-key \
  whatsapp-business-account-id \
  whatsapp-phone-number-id \
  whatsapp-contact-url \
  whatsapp-app-secret \
  whatsapp-access-token \
  whatsapp-verify-token \
  message-encryption-key
do
  source_file=$source_dir/$credential
  test -f "$source_file" || { echo "missing systemd credential: $credential" >&2; exit 1; }
  install -m 0440 -o "$credential_uid" -g "$credential_gid" "$source_file" "$target_dir/$credential"
done
