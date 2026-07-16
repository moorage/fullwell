# Git Signing Key Recovery

Household commits use a service SSH signing key held outside repositories. The public-key trust set and key-validity periods are versioned operational metadata; private keys never enter Git or backups encrypted by themselves.

The runtime verifier reads the root-owned `git-allowed-signers` credential in OpenSSH allowed-signers format. Each active or historical public key uses the fixed principal `service@invalid.local`; repository content cannot supply or modify this file.

## Planned rotation

1. Generate the new key in the approved secret system. Record its public fingerprint and activation time.
2. Add the new public key to the verifier trust set while retaining the old public key for historical commits.
3. Install the new encrypted private credential, restart, and create a staging canary commit.
4. Verify the canary against the new fingerprint, then make production sign new commits with that key.
5. Verify a sample of old and new commits and a fresh bundle/manifest. Revoke or archive the old private key after the overlap window; keep its public verification material.

## Lost or compromised key

1. Fence all journal writes. Reads may continue only if repository integrity and disclosure risk are understood.
2. Preserve logs, manifests, signatures, HEADs, and backup checkpoints without copying private journal content into the incident record.
3. Mark the old fingerprint compromised or unavailable at a precise time. Do not rewrite or resign historical commits.
4. Generate and install a new key through two-person production control. Add its public key and validity start to the trust set.
5. Verify every repository from the last trusted signed manifest through current HEAD. Quarantine unsigned, invalid, unexpected-parent, or non-fast-forward history.
6. Reconcile operational projections only from verified histories. Restore quarantined repositories from a trusted bundle when necessary.
7. Create a signed key-rotation operator event and fresh signed backup manifest. Resume writes only after canary mutation, backup, restore verification, and security approval.

Historical verification accepts the key valid at commit time. It must never accept arbitrary repository-provided keys.
