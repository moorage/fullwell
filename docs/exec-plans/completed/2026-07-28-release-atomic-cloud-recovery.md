# Release Atomic Cloud Recovery And Repair The Saved Recipe

## Purpose / Big Picture

The atomic recovered-cloud journal fix is implemented and verified locally, but
the public server and immutable agent package still run the earlier split-write
contract. The original live recipe save also left one valid append-only
evidence record in Git without its recipe item because the old server returned
success before persisting the matching Neon projection.

This release deploys the server contract first, reconciles the Git-authoritative
projection, publishes and installs agent package `1.1.20`, and then repairs the
single missing recipe item through the authenticated MCP journal mutation. It
does not edit production Neon directly, delete or duplicate evidence, expose
credentials, or create a second local household authority.

## Progress

- [x] 2026-07-28T20:45Z: Created and claimed Beads task `fullwell-4yz`.
- [x] 2026-07-28T20:45Z: Confirmed npm publication authority, current host
  versions, the active DigitalOcean image, and the server-before-client
  compatibility requirement.
- [x] 2026-07-28T20:50Z: Completed the failure-oriented plan critique and added
  private-output redaction, staged-diff allowlisting, immutable-publication
  rollback, and ephemeral-repair transcript controls.
- [x] 2026-07-28T20:54Z: Prepared the 33-entry `1.1.20` artifact; package
  validation, 14 eval tests, 53 lifecycle tests, zero-production-vulnerability
  audit, eight-migration PostgreSQL cycle with 12 integrations, 142 WebKit
  checks with 22 intentional skips, and full repository verification pass.
- [x] 2026-07-28T20:56Z: Milestone 1 complete. Release commit `3b722e9`
  is pushed and the exact committed source produced the verified amd64 image.
- [x] 2026-07-28T20:59Z: Milestone 2 complete. The compatible server is live;
  deployment/MCP smokes, maintenance, repository validation, and bounded logs
  pass with zero quarantines, invalid repositories, warnings, or errors.
- [x] 2026-07-28T21:03Z: Milestone 3 complete. Immutable package `1.1.20`
  is public, its clean download matches the prepared checksum, and Codex and
  Claude both run it enabled with connected local and cloud MCP servers.
- [x] 2026-07-28T21:09Z: Milestone 4 complete. The isolated authenticated
  recovery created the missing recipe item without new evidence, exact search
  passed, and an identical fresh run returned `REPAIR_NOOP`.
- [x] 2026-07-28T21:12Z: Milestone 5 complete. A fresh backup and aggregate
  health checks pass, sanitized release evidence is recorded, and the plan is
  complete.

## Surprises & Discoveries

- 2026-07-28: The local `NEON_API_KEY` startup warning is unrelated to the
  hosted Fullwell service. Public Fullwell MCP calls already reached the
  deployed server through OAuth.
- 2026-07-28: Agent `1.1.20` sends a new strict `evidence` field to
  `hfj_commit_change_set`; the current server does not accept it. The server
  therefore must deploy and pass a soak gate before the package is published.
- 2026-07-28: The reconciliation worker compares complete Git-derived and Neon
  projection content even when their HEADs match. Running supported maintenance
  after deployment can recover the accepted evidence without a database edit.
- 2026-07-28: Current Codex and Claude installations both run enabled package
  `1.1.19`, npm `latest` is `1.1.19`, and the current server image is retained as
  the pre-release rollback image.
- 2026-07-28: Apple Container exported the expected OCI index and amd64
  manifest, while Docker 29 identifies the imported tag by the OCI index digest
  rather than the image config digest. The first guarded activation stopped
  before changing service state; using the already verified index digest made
  the retry pass.
- 2026-07-28: npm web OTP requires a TTY. The non-interactive publish attempt
  returned a redacted one-time URL and made no registry change; the TTY retry
  opened npm's first-party WebAuthn flow and published the same prepared
  artifact.
- 2026-07-28: Maintenance checked the incomplete mutation with no quarantine
  and no rebuild required. The repaired item then committed against the
  original evidence through the new Git-aware validation path.

## Decision Log

- 2026-07-28: Release server first, then client. Publishing first would make
  ordinary new-client saves fail against the old strict input schema.
- 2026-07-28: Use the existing maintenance service for projection rebuilding.
  Git is authoritative; direct Neon repair would bypass typed validation,
  auditability, and the documented recovery boundary.
- 2026-07-28: Repair with an item-only `hfj_commit_change_set` that cites the
  already accepted evidence ID and reuses the originally authored stable item
  ID. Do not append replacement evidence.
- 2026-07-28: Search before repair and stop without mutation if the recipe item
  already exists. Use a fresh stable repair idempotency key only when the item
  is absent.
- 2026-07-28: Once `1.1.20` is public, do not roll the server back to the old
  strict change-set schema. Keep the compatible server live or ship a forward
  fix; an old server would break published clients.
- 2026-07-28: Exclude the pre-existing
  `docs/self-improvement/candidate-lessons.md` change from release staging.
- 2026-07-28: Parse maintenance and operator output on the release host and
  return only aggregate counts and booleans. Raw maintenance output contains
  household IDs and is not release evidence.
- 2026-07-28: Run the repair in an ephemeral isolated host session, retain no
  detailed transcript, and emit only a sanitized success, no-op, or failure
  result.

## Context and Orientation

The implementation being released is recorded in
`docs/exec-plans/completed/2026-07-28-atomic-cloud-journal-save.md`.
`packages/contracts/src/tools.ts` defines the atomic input, and
`apps/server/src/services/household-food-journal.ts` validates and persists the
transaction-scoped projection. `apps/server/src/workers/reconciliation-worker.ts`
rebuilds disposable Neon projections from signed Git.

The agent package version appears in:

- `packages/agent-client/package.json`
- `packages/agent-client/install-metadata.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `package-lock.json`

The checked-in package changelog, release evidence, implementation log, active
plan list, and generated repository map must describe the final release.

Production runs one Linux/amd64 image through systemd and Docker Compose on the
configured DigitalOcean release host. The root-owned `/etc/hfj/deploy.env`
selects the immutable local image tag; the existing image and a timestamped
environment copy are the rollback unit. No migration is required because the
database schema remains `0008`.

The one-time household repair is private operational work. The ExecPlan and
release evidence may say that one orphan recipe was repaired, but they must not
record household/user/actor IDs, source URLs, food names, evidence IDs, raw tool
payloads, access tokens, or journal bodies.

### Framing Notes

Expert panel:

- Release engineer — immutable package and exact image provenance must be
  verifiable before publication or activation.
- Reliability engineer — reconcile Git to Neon before the citing mutation and
  retain an automatic server rollback boundary.
- Security/privacy reviewer — use OAuth and typed journal tools, not database
  credentials, and keep private repair data out of release records.
- Agent UX/evals expert — upgrade both installed hosts only after the compatible
  server is live and prove the recovered-account behavior through the public
  client.

The synthesis is a strict dependency chain: verified source commit, compatible
server deployment, projection reconciliation, immutable package publication,
host upgrades, and finally one idempotent authenticated repair.

## Milestones

### Milestone 1 — Prepare And Push Release 1.1.20

Files:

- `packages/agent-client/package.json`
- `packages/agent-client/install-metadata.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `package-lock.json`
- `packages/agent-client/CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/generated/repo-map.json`
- this ExecPlan

Tasks:

1. Move the Unreleased changelog entry under `1.1.20`.
2. Update every package and marketplace version together.
3. Run package validation, evals, lifecycle tests, the full repository gate,
   PostgreSQL verification, WebKit acceptance, and production dependency audit.
4. Build a dry package artifact and record its bounded file count and checksums.
5. Review the diff and stage only this release's changes. Exclude the
   pre-existing candidate-lessons edit and ignored operator credentials.
6. Inspect `git diff --cached --name-status` against an explicit release
   allowlist before committing; stop if any unrelated path is staged.
7. Commit atomically with exactly one `AI-Model: gpt-5.6` trailer and push
   `main`. Build deployment artifacts only from that pushed commit.

Verification:

- `npm run test:evals`
- `npm run test:packaging`
- `npm run container:postgres:verify`
- `npm run test:e2e`
- `npm run verify`
- `npm audit --omit=dev`
- `npm pack --dry-run --json --workspace @fullwell/fullwell`
- `git status --short`

### Milestone 2 — Deploy Server And Reconcile Projection

Files:

- `Dockerfile`
- `deploy/compose.yaml`
- `deploy/systemd/household-food-journal.service`
- `deploy/systemd/household-food-journal-maintenance.service`
- operator-only ignored artifacts under `.codex/runtime/`

Tasks:

1. Build the pushed commit as a `linux/amd64` OCI image with a unique immutable
   release tag.
2. Export the exact amd64 variant and verify its local SHA-256, OCI index, and
   concrete amd64 manifest.
3. Transfer the archive to the configured release host, verify the remote
   checksum, normalize the imported Docker tag, and run the Node runtime canary.
4. Preserve the current image and `/etc/hfj/deploy.env`, activate the new image,
   and automatically restore the prior image if service start, liveness, or
   readiness fails.
5. Run deployment and MCP discovery smokes plus bounded warning-log inspection.
6. Start the supported one-shot maintenance service. Parse its JSON on the
   release host and emit only `ok`, aggregate reconciliation/backup counts,
   repository count, and invalid-repository count. Require zero quarantines and
   invalid repositories.
7. Recheck readiness and operator reconciliation health before package
   publication.

Verification:

- `container image inspect`
- `container image save --platform linux/amd64`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- staging`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- staging`
- remote `systemctl start household-food-journal-maintenance.service`
- remote service, readiness, operator-health, image, and log checks

Rollback:

- Before package publication, restore the preserved environment and previous
  immutable image if any server or reconciliation gate fails.
- Do not publish or repair while the old server is active or reconciliation is
  unhealthy.

### Milestone 3 — Publish And Install Agent Package

Files:

- the committed `packages/agent-client/` release artifact
- current Codex and Claude plugin installations

Tasks:

1. Publish `@fullwell/fullwell@1.1.20` once with public access.
2. Verify npm `latest`, publish time, SHA-1, SHA-512, version, and artifact file
   count against the prepared artifact.
3. Download a clean registry copy and rerun isolated Codex and Claude lifecycle
   tests.
4. Upgrade the configured Codex marketplace and reinstall/update the current
   enabled plugin without changing MCP identity or deleting OAuth state.
5. Update the current Claude plugin and verify both `fullwell-local` and
   `fullwell-cloud` connect.

Verification:

- `npm publish --workspace @fullwell/fullwell --access public`
- `npm view @fullwell/fullwell@1.1.20 --json`
- `codex plugin list --json`
- `claude plugin list --json`
- `claude mcp list`

Rollback:

- npm releases are immutable. If package verification fails, do not republish
  the same version; diagnose and release a higher patch.
- After publication, retain the compatible server. Host rollback to `1.1.19`
  is allowed only as a temporary client measure and does not justify server
  rollback.

### Milestone 4 — Repair The Existing Recipe

Files:

- no repository source file; this is an authenticated live journal mutation

Tasks:

1. Use an isolated ephemeral Codex session with the current authenticated
   `fullwell-cloud` connection. Keep its detailed output in a mode-`0700`
   temporary directory, print only a sanitized terminal result, and remove the
   directory after verification.
2. Load context and search for the recipe. If it already exists, stop without a
   mutation.
3. If absent, call `hfj_commit_change_set` once with no new evidence, the
   original stable recipe item ID, the original accepted evidence ID, current
   HEAD, empty expected revisions, and a fresh stable repair idempotency key.
4. Do not browse, call `hfj_append_evidence`, change Saved/Cooked/Liked meaning,
   or expose internal IDs in the terminal summary.
5. Search again and require exactly one recipe item with the intended stable
   item ID. Repeating the same repair instruction must be a no-op or exact
   idempotent replay.
6. Run a post-repair maintenance backup and recheck aggregate operator health.

Verification:

- authenticated `hfj_get_context`
- authenticated `hfj_search_items`
- one conditional authenticated `hfj_commit_change_set`
- second authenticated `hfj_search_items`
- remote maintenance backup and operator health

Recovery:

- A pre-commit validation or revision conflict leaves Git unchanged; refresh
  context and rebuild the same item-only request.
- If Git commits but the response is uncertain, search first and reuse the same
  repair key and payload only for an exact retry.
- Never delete or rewrite the original evidence.

### Milestone 5 — Record And Close

Files:

- `docs/release/verification-evidence.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/generated/repo-map.json`
- this ExecPlan
- `.beads/issues.jsonl`

Tasks:

1. Record public package/image checksums, rollback image, aggregate
   reconciliation and smoke results, and the private repair outcome without
   household data.
2. Refresh generated knowledge, rerun docs and ExecPlan validation, commit and
   push the release evidence with the required trailer.
3. Move this plan to `docs/exec-plans/completed/`.
4. Close `fullwell-4yz` only after package, deployment, repair, backup, and
   documentation acceptance all pass.

Verification:

- `npm run knowledge:refresh`
- `npm run verify:docs`
- `npm run verify:execplan`
- `bd show fullwell-4yz`
- `git status --short`

## Acceptance / Verification

- Public server accepts one atomic evidence-plus-item change set and returns the
  authenticated actor ID in context.
- Maintenance checks the signed Git projection with no rebuild or quarantine.
- Public `@fullwell/fullwell@1.1.20` matches the prepared immutable artifact and
  both current hosts run it enabled with local and cloud MCP identities intact.
- Deployment readiness, MCP discovery, production audit, persistence,
  repository/signature, and aggregate operator checks pass.
- The original recipe evidence is cited by exactly one searchable recipe item;
  no replacement evidence is appended and no database row is edited directly.
- A fresh post-repair backup succeeds.
- The release commit and final evidence commit are pushed with exact
  `AI-Model: gpt-5.6` trailers.
- Rollback identifiers are retained without recording secrets or private
  household content.
- Required release gates:
  `npm run container:postgres:verify`,
  `npm run test:e2e`,
  `npm run verify`,
  `npm audit --omit=dev`,
  `STAGING_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- staging`,
  `STAGING_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- staging`,
  `npm run verify:docs`, and
  `npm run verify:execplan`.

## Outcomes & Retrospective

Release commit `3b722e9` is pushed. The compatible Linux/amd64 server is live at
OCI index `sha256:31770ccd0f931515ede2d8ae30be5354ed5608d2369128b6cb7e2cf8fe830a77`
and concrete manifest
`sha256:166331785db5ee8242c481f7deed1c237cafd68f015179b60d00d8cf66cfd4f7`
from archive SHA-256
`45372657be12b146b360ba51dcfaf1a5decace7697937df2de23d021293bbd15`.
Public package `1.1.20` byte-matches its prepared artifact at SHA-1
`f0491629ffd078a734093b3f7b8556272d4bea76`; Codex and Claude both run it
enabled with connected local and cloud MCP servers.

The supported maintenance path found zero quarantine or repository failures.
The isolated authenticated recovery created the one missing recipe item while
citing the original evidence and appending none; exact search passed and a
fresh identical run returned `REPAIR_NOOP`. Post-repair maintenance completed
one backup, and readiness, reconciliation, repository, signing, restore,
volume, deployment, MCP, package, and log gates pass. Aggregate operator status
remains degraded only by the pre-existing WhatsApp response-ready queue, which
is outside this release. The previous image and root-only environment backup
retain rollback, and no migration, direct Neon edit, duplicate evidence, or
private repair transcript was created.
