# Sanitize Fullwell for Public Repository Visibility

## Purpose / Big Picture

Prepare `moorage/fullwell` for a later visibility change without publishing it during this work. The resulting private GitHub repository must contain a rewritten `main` history that preserves useful product and engineering history while removing local machine paths, exact infrastructure addresses, internal Beads issue exports, Beads interaction history, and the remotely discoverable Dolt database refs. The production WhatsApp verification token that was visible to authorized browser accessibility tooling must be rotated without exposing either value. The production dependency tree must remain clear of `GHSA-v2hh-gcrm-f6hx`. Licensing must be explicit: absent a separate owner decision to grant reuse rights, the public source remains all-rights-reserved and `UNLICENSED`.

The rewrite is destructive to commit identities, so it is developed and scanned in an isolated mirror, backed up in a local bundle, and applied to GitHub only after exact old/new ref checks. The repository remains private at the end; changing visibility is a separate deliberate action after GitHub has settled the force update.

## Progress

- [x] 2026-07-30T20:20Z: Created, scoped, and claimed Beads tasks `fullwell-bwv`, `fullwell-z0t`, and `fullwell-i7a`.
- [x] 2026-07-30T20:25Z: Completed the limited historical audit: no verified secret, phone number, payment card, SSN, or street address was found; local author paths, infrastructure addresses, internal tracker history, and operational metadata were found.
- [x] 2026-07-30T20:31Z: Revalidated `GHSA-v2hh-gcrm-f6hx`; current `main` resolves patched `fast-uri` 3.1.4 and 4.1.1 and `npm audit --omit=dev` reports zero vulnerabilities.
- [x] 2026-07-30T20:40Z: Completed expert framing across security/privacy, Git release engineering, operations/reliability, maintainer/contributor UX, and licensing.
- [x] 2026-07-30T20:48Z: Completed the feature-critic gate; strengthened candidate-tip construction, file-only old-token proof, unreachable-object claims, and fresh-clone tracker bootstrap.
- [x] 2026-07-30T21:10Z: Closed the production and development dependency findings with zero npm advisories, passing ESLint 10, typechecks, package validation, and 90.04% branch coverage.
- [x] 2026-07-30T21:10Z: Staged root-only old/new token proof files and an encrypted replacement credential on production without changing the active credential.
- [x] 2026-07-30T21:25Z: Added and verified the shared sensitive-content scanner at the staged pre-commit and repository-wide verification boundaries; closed `fullwell-9lk`.
- [x] 2026-07-30T21:31Z: Built and validated the 128-commit rewritten candidate at `257d90f91987dbd0a139ecc0ce870b5a2181a222`; strict Git integrity, isolated full verification, targeted history scans, and the reviewed Gitleaks fixture baseline passed.
- [x] 2026-07-30T21:54Z: Activated the user-generated Meta verification token as an encrypted production credential; the current challenge passed, both prior values returned `403`, unsigned delivery returned `403`, signed delivery returned `200`, and temporary plaintext and rollback copies were removed.
- [x] 2026-07-30T21:57Z: Atomically force-updated GitHub `main` with exact leases and deleted `refs/heads/__dolt_remote_info__` plus `refs/dolt/data`; the repository remained private.
- [x] 2026-07-30T21:59Z: Re-cloned GitHub over the network and passed strict Git integrity, zero-advisory install, the full repository verification gate, targeted full-history privacy checks, and the reviewed Gitleaks 8.30.1 baseline.
- [x] Milestone 2: Rotate and validate the production WhatsApp webhook verification token.
- [x] Milestone 3: Sanitize the current tree, add a future sensitive-content gate, and detach private Beads data from the public Git remote.
- [x] Milestone 4: Build and validate a rewritten history in an isolated mirror.
- [x] Milestone 5: Apply the verified rewrite to local `main` and GitHub, remove custom refs, and re-audit a fresh clone.
- [x] Milestone 6: Complete documentation, quality gates, Beads closure, and recovery handoff.

## Surprises & Discoveries

- 2026-07-30: The dependency advisory issue was already fixed by commit `785ec06`; the current lockfile uses the advisory's first patched releases and needs validation and issue closure, not another package update.
- 2026-07-30: The GitHub repository exposes both `refs/heads/__dolt_remote_info__` and `refs/dolt/data`. Removing `.beads/issues.jsonl` from `main` alone would not remove discoverable issue history.
- 2026-07-30: `.beads/issues.jsonl` contains exact local paths, owner identity, deployment and release notes, and internal operational tasks. Its history is more sensitive than the application tree and is not needed to build or run Fullwell.
- 2026-07-30: The repository and published `@fullwell/fullwell` package declare no license. Making the repository public would not itself grant reuse rights, but an explicit notice avoids ambiguity.
- 2026-07-30: GitHub branch protection and rulesets are unavailable while this personal repository is private, so exact ref comparisons and a local recovery bundle are the primary rewrite safeguards.
- 2026-07-30: GitHub may retain unreachable objects after a force update. Because the repository has never been public and no verified secret was committed, making all public refs clean before visibility changes is the relevant publication boundary; the work must not claim immediate physical erasure from GitHub storage.
- 2026-07-30: Full `npm audit` found eight development-tool advisories not present in the production-only audit. ESLint 10 and its compatible peers remove the lint path. Vitest 4 changed branch accounting enough to fail the established 90% gate despite all tests passing, so the compatible fix retains Vitest 3.2.7 and overrides only `test-exclude` to patched 8.0.0; the full audit and 90.04% branch gate both pass.
- 2026-07-30: The token entered in Meta was newly generated by the owner and differed from the initially staged replacement. Production therefore treated the ignored local `.env.local` value as the handoff source, encrypted it directly from standard input, and validated it without displaying or persisting plaintext outside the existing ignored local file.
- 2026-07-30: The first dependency-based local dotenv parse failed before sending a value. The retained encrypted rollback copy allowed the credential to be replaced immediately through a strict dependency-free parser; all challenge, signature, readiness, and prior-token rejection checks then passed before temporary copies were removed.

## Decision Log

- 2026-07-30: Leave GitHub visibility private during remediation. Rationale: a rewritten private repository can settle and be freshly cloned and rescanned before any unauthenticated access exists.
- 2026-07-30: Treat the current licensing posture as `UNLICENSED` and all-rights-reserved. Rationale: this makes the existing no-grant default explicit without assuming authority to choose an open-source license. A later owner decision may replace it with an OSI license.
- 2026-07-30: Remove `.beads/issues.jsonl` and `.beads/interactions.jsonl` from every rewritten commit, disable automatic public export and same-repository Dolt sync, and delete `refs/heads/__dolt_remote_info__` plus `refs/dolt/data` from GitHub. Rationale: the tracker contains internal operational history and personal paths but is not a runtime dependency. The ignored local Dolt store remains authoritative for ongoing work.
- 2026-07-30: Replace exact historical machine paths with stable placeholders and exact historical infrastructure IPs with descriptive host placeholders. Preserve author names, permitted author email addresses, messages, and timestamps, but normalize author and committer timezone offsets to UTC. Rationale: retain attribution and chronology while removing the unnecessary location signal.
- 2026-07-30: Use `git-filter-repo` in an isolated bare mirror and a literal replacement map. Rationale: it rewrites each object once, can delete tracker paths and normalize commit metadata deterministically, and is safer than a working-tree `filter-branch`.
- 2026-07-30: Create a full local bundle before the remote rewrite and never push a backup ref to GitHub. Rationale: rollback remains possible without making the removed objects remotely reachable.
- 2026-07-30: Commit the reviewed sanitized current tree locally before cloning the rewrite candidate, then rewrite that local ref together with historical objects. Rationale: the candidate must have one reproducible Git source rather than an out-of-band working-tree overlay.
- 2026-07-30: Preserve the old verification token only as a mode-`0600` file on production tmpfs until rejection is proven. Rationale: the acceptance check needs the actual old value, but it must never become a shell argument, environment value, transcript, screenshot, or local artifact.

## Framing Notes

### Expert panel

- Security and privacy reviewer: secrets, PII, metadata minimization, historical reachability, and post-rewrite scanning.
- Git release engineer: ref inventory, object rewrite, force-with-lease semantics, recovery bundle, and fresh-clone proof.
- Operations and reliability engineer: coordinated systemd credential rotation, Meta verification, delivery smoke, and rollback.
- Maintainer and contributor-experience reviewer: public clone behavior, Beads detachment, documentation, and future accidental re-export prevention.
- Licensing reviewer: distinguish public visibility from an open-source grant and avoid silently choosing rights on the owner's behalf.

### What problem are we actually solving?

The problem is not a verified leaked Git credential. It is preventing currently private operational and personal context from becoming public through any reachable Git ref while also closing the one non-Git credential-exposure event and proving the production dependency boundary is patched. A successful result is a private, fully rescanned publication candidate with a recovery path.

### Highlights and tensions

- The safest tracker treatment is whole-path removal, not field-by-field redaction; issue prose can reveal new operational context that a replacement map misses.
- Useful engineering history argues for targeted text substitution rather than squashing to one commit.
- Force rewriting `main` makes every commit ID change and requires all clones to reclone; preserving old hashes is incompatible with removing historical blobs.
- Public source does not require open-source licensing. The least assumptive immediate posture is an explicit no-grant notice.
- Token rotation spans two authorities, production systemd credentials and Meta configuration, so partial completion must remain recoverable and must never log a secret.
- Removing private tracker exports must not leave the repository instructions telling a fresh contributor to use an impossible tracker. A clone must either bootstrap an empty local Beads store through documented commands or clearly scope Beads to maintainers with an existing private store.

### Synthesis

Perform operational rotation first, then make current-tree privacy controls durable, then build a bare rewritten candidate from the exact GitHub refs. Validate object reachability, secret/privacy patterns, final-tree equivalence, package integrity, and repository quality gates before the only remote mutation. Delete custom tracker refs in the same maintenance window, fresh-clone over the network, and repeat the audit before considering visibility.

## Context and Orientation

`docs/SECURITY.md` defines the credential and logging invariants. `docs/RELIABILITY.md` and `docs/EXECUTION_GUIDE.md` define systemd encrypted-credential rotation: replace the encrypted blob, restart the application unit, and force container recreation. `deploy/systemd/household-food-journal.service` binds `hfj-whatsapp-verify-token` into the application runtime. `scripts/ci/messaging-smoke.mjs` validates wrong-token rejection, correct challenge verification, and signed webhook delivery while reading all sensitive values from files.

`.beads/issues.jsonl` and `.beads/interactions.jsonl` are currently tracked passive exports. `.beads/config.yaml` enables automatic export and points Dolt synchronization at the application GitHub repository. The local Dolt database and backups are already ignored, so tracker use can continue locally after exports and same-repository sync are disabled.

The current GitHub ref inventory is:

- `refs/heads/main` at `8a54b422a26dcb5bf3380696aed47028b8e9d6a2`
- `refs/heads/__dolt_remote_info__` at `98542516d1dfb5e21ca5f4d6fec0d7798dc13c3c`
- `refs/dolt/data` at `62a302262d2f79ec94aa15d7585e7377dd631301`

The limited audit covered 152 reachable commits, 2,440 blobs, 1,940 trees, the complete exported Beads issue history, commit messages, and binary strings. Gitleaks 8.30.1 produced only test-fixture and idempotency-key false positives. That evidence is a baseline, not proof of the future candidate.

## Milestones

### Milestone 1 - Finalize the rewrite contract

Files:

- `docs/exec-plans/active/2026-07-30-public-repository-sanitization.md`
- `.beads/issues.jsonl`

Tasks:

1. Run the feature-critic gate from security/privacy, Git recovery, operations, licensing, and contributor lenses.
2. Record must-fix critique in this plan before editing repository content.
3. Capture exact expected source refs and stop if GitHub changes before the force update.

Verification:

- `npm run verify:execplan`
- `git ls-remote origin`

### Milestone 2 - Rotate the WhatsApp verification token

Files:

- No secret-bearing repository file.
- `docs/exec-plans/active/2026-07-30-public-repository-sanitization.md`
- `docs/IMPLEMENTATION_LOG.md`

Tasks:

1. Generate a new bounded random token directly into a mode-`0600` temporary file without printing it.
2. Create a replacement encrypted systemd credential on the production host and retain a recoverable copy of the old encrypted blob until validation finishes.
3. Update the Meta webhook verification value through the authorized browser without screenshots, accessibility dumps, clipboard history, or transcript output containing the value.
4. Restart the application unit so systemd reacquires credentials and Compose recreates the application container.
5. Run the repository messaging smoke using credential-file inputs, explicitly prove the file-held old token is rejected and the file-held new token succeeds, and prove signed delivery still succeeds.
6. Remove temporary plaintext and the retained old encrypted blob after complete verification.

Verification:

- `npm run test:messaging-smoke` or the exact documented `node scripts/ci/messaging-smoke.mjs` invocation with file-only credential inputs
- `curl -fsS https://fullwell.ai/health/ready`
- `systemctl is-active household-food-journal.service`

Recovery:

If Meta verification or signed delivery fails, restore the retained old encrypted credential, restore the old Meta value without printing it, restart the unit, and rerun the smoke before leaving the maintenance window.

### Milestone 3 - Sanitize the current tree and future workflow

Files:

- `LICENSE`
- `README.md`
- `package.json`
- `packages/agent-client/package.json`
- `.gitignore`
- `.beads/config.yaml`
- `.beads/issues.jsonl` (remove from Git)
- `.beads/interactions.jsonl` (remove from Git)
- Historical docs identified by the privacy scan
- `docs/SECURITY.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` and package changelogs when present
- `scripts/security/check-sensitive-content.mjs`
- `scripts/security/check-sensitive-content.test.mjs`
- `scripts/git-hooks/pre-commit.mjs`
- `.codex/local-environment.yaml`

Tasks:

1. Add an explicit all-rights-reserved notice and mark package metadata `UNLICENSED`.
2. Replace exact local paths with `<local-source>` or repository-relative paths and replace exact infrastructure IPs with descriptive DNS or role labels.
3. Disable automatic Beads JSON export and remove the application-repository sync target.
4. Ignore the private exports so routine `bd` use cannot accidentally stage them again.
5. Remove the tracked issue and interaction exports while retaining the ignored local Dolt database.
6. Update security and contributor guidance to state that private tracker data and Dolt refs must not use the public application remote.
7. Verify a fresh local clone can follow the documented maintainer/contributor workflow without access to the private tracker store.
8. Apply one shared scanner to the final staged index in the pre-commit hook and to repository files in `npm run verify`.
9. Cover private tracker paths, sensitive filenames, high-confidence credential formats, author-specific paths, redacted diagnostics, and legitimate placeholders with regression tests.
10. Put the no-sensitive-content contract in the README, both agent guides, security guidance, and Codex local-environment actions.

Verification:

- `npm run verify:sensitive`
- `npm run test:git-hooks`
- `rg -n '/Users/' --hidden --glob '!.git/**' --glob '!node_modules/**' .`
- Review non-loopback IPv4 literals and require a documented public protocol reason for every retained value.
- `git ls-files '.beads/issues.jsonl' '.beads/interactions.jsonl'`
- `npm audit --omit=dev`

### Milestone 4 - Build and validate the isolated rewritten candidate

Files:

- A private temporary bare mirror outside the repository.
- A local full-history recovery bundle outside the repository.
- A literal replacement map outside the repository containing no secret.

Tasks:

1. Fetch and checksum-verify a pinned official `git-filter-repo` release.
2. Create a full bundle containing every current local and remote ref.
3. Commit the reviewed sanitized tree locally, clone the exact local source into a new explicit temporary bare mirror, and verify its parent plus GitHub source object IDs against this plan.
4. Rewrite all commits to remove the two private Beads paths, replace every identified path and infrastructure literal, and normalize author/committer timezone offsets to UTC.
5. Delete non-public refs from the candidate namespace.
6. Prove that forbidden blobs are unreachable, `git fsck --full` succeeds, and the candidate's final tree matches the reviewed committed tree.
7. Repeat Gitleaks, targeted secret/PII scans, commit-message scans, binary string scans, and Beads-path/ref scans.

Verification:

- `git fsck --full`
- `git rev-list --objects --all`
- `gitleaks git --no-banner --redact --report-format json --report-path <candidate-report> <candidate>`
- `git for-each-ref`
- `git diff --no-index <reviewed-tree> <candidate-tree>`

Recovery:

No production or GitHub state changes in this milestone. Delete the candidate and restart from the bundle or `origin` if any invariant fails.

### Milestone 5 - Apply the verified rewrite

Files:

- Local `main` ref and GitHub refs only; no unreviewed working-tree edit.

Tasks:

1. Re-read GitHub refs and stop if `main`, `__dolt_remote_info__`, or `refs/dolt/data` differs from the recorded source IDs.
2. Update local `main` to the verified candidate while preserving the local recovery bundle.
3. Force-update only `refs/heads/main` using an exact lease against `8a54b422a26dcb5bf3380696aed47028b8e9d6a2`.
4. Delete `refs/heads/__dolt_remote_info__` and `refs/dolt/data` using exact old-object checks.
5. Prune local remote-tracking refs, fresh-clone GitHub into a new directory, and repeat ref inventory, Git integrity, Gitleaks, privacy, package audit, and repository verification.
6. Keep the GitHub repository private and record that every existing clone must be discarded and recloned. State that removed objects are unreachable from public refs, not that GitHub has immediately purged all internal storage.

Verification:

- `git ls-remote origin`
- `git fsck --full`
- `npm audit --omit=dev`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

Recovery:

Before any visibility change, the local bundle can restore `main` with an exact force update. Restoring the removed private tracker refs to the application remote is intentionally not part of normal rollback; the local Dolt database remains the tracker recovery source.

### Milestone 6 - Close the release-preparation loop

Files:

- `docs/exec-plans/active/2026-07-30-public-repository-sanitization.md`
- `docs/IMPLEMENTATION_LOG.md`
- `.beads/issues.jsonl` only as an ignored local export if explicitly needed for local recovery

Tasks:

1. Record exact old/new commit IDs, bundle path and digest, scan tool versions, commands, and results without secret values.
2. Close `fullwell-i7a` as already remediated and verified; close `fullwell-z0t` and `fullwell-bwv` only after their acceptance criteria pass.
3. Move this plan to `docs/exec-plans/completed/`.
4. Run final status and report that GitHub remains private and that publication is a separate action.

Verification:

- `bd show fullwell-bwv`
- `bd show fullwell-z0t`
- `bd show fullwell-i7a`
- `git status --short --branch`

## Idempotence and Recovery

All destructive Git commands use explicit ref names and old object IDs. Candidate generation is repeatable from `origin` plus the replacement map. The local bundle is immutable recovery evidence and its SHA-256 is recorded. No broad deletion targets, workspace-root cleanup, wildcard ref deletion, or backup ref on GitHub is allowed.

Credential rotation has an explicit two-authority rollback. The old encrypted blob remains only on the production host until the new Meta and application values pass challenge and signed-delivery validation. Neither old nor new plaintext may appear in commands, output, Git, Beads, screenshots, or logs.

## Acceptance / Verification

- GitHub remains private and exposes only the intentional `main` branch after the rewrite.
- A fresh network clone contains no `.beads/issues.jsonl`, `.beads/interactions.jsonl`, exact author home path, or exact historical infrastructure address in any reachable commit or blob.
- No `refs/heads/__dolt_remote_info__`, `refs/dolt/data`, tags, pull refs, or other unexpected public refs remain.
- Gitleaks and targeted secret, PII, commit-message, binary, and dependency scans pass on the fresh clone; documented test fixtures are reviewed rather than silently suppressed.
- The new WhatsApp token passes challenge verification, an incorrect/old value fails, and signed webhook delivery remains healthy without any token value in evidence.
- `fast-uri` remains at patched versions and `npm audit --omit=dev` reports zero vulnerabilities.
- The repository explicitly states `UNLICENSED` / all rights reserved and does not imply an open-source grant.
- `npm run verify`, `npm run verify:docs`, and `npm run verify:execplan` pass from the fresh clone.
- The full recovery bundle exists locally, has a recorded SHA-256, and can list the original `main` and private tracker refs.
- Existing clones are treated as contaminated with obsolete history and must be discarded and recloned.

## Outcomes & Retrospective

- Rewrote GitHub `main` from `8a54b422a26dcb5bf3380696aed47028b8e9d6a2` to `257d90f91987dbd0a139ecc0ce870b5a2181a222`, preserving 128 useful commits while removing private tracker blobs, identified local paths, exact infrastructure literals, and non-UTC metadata from reachable history.
- Deleted `refs/heads/__dolt_remote_info__` and `refs/dolt/data`. GitHub now advertises only `HEAD` and `refs/heads/main`; the repository remains private pending a separate owner visibility decision.
- Rotated the WhatsApp verification token into the encrypted production credential store. The current challenge and signed webhook pass, both retained prior tokens and unsigned delivery fail closed, production readiness is healthy, and all temporary plaintext, rollback, staged, and clipboard copies were removed.
- The fresh GitHub clone passed `git fsck --full --strict`, `npm ci` with zero advisories, `npm run verify`, targeted full-history privacy scans, UTC metadata validation, and Gitleaks 8.30.1 with the same 23 reviewed synthetic-fixture findings as the isolated candidate.
- The recovery bundle is `/private/tmp/fullwell-history-rewrite-ready.lmwFGh/fullwell-pre-publication.bundle` with SHA-256 `5543427a0bbe892cb0a035cc7acfabd2834a64497a8545507463d433c353173b`. It must remain local and private.
- This was the requested limited audit plus deterministic full-history checks, not an exhaustive external deep scan. Existing clones retain obsolete object history and must be discarded and recloned before future work.
