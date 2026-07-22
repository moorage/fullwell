# Approval-Efficient Fullwell Onboarding

## Purpose / Big Picture

Fullwell onboarding currently turns one conversational snack-then-recipe flow into a sequence of separately approved MCP reads and writes. The user should instead approve at most one initial Fullwell read and one final Fullwell write in the normal fresh-household path. `hfj_get_context` returns a bounded, membership-authorized onboarding snapshot containing the current user ID, section states, snack and recipe profiles, repository HEAD, and a bounded existing-item index. Codex or Claude checkpoints answers and collected evidence in a local, identity-sharded draft until it can show a final summary. One `hfj_commit_onboarding` tool then validates and persists the complete evidence, item, report, profile, and skip result as one idempotent household mutation and one signed Git commit.

The final write must also fit real grocery histories. The original 100-item and 500-evidence limits were conservative schema guards chosen alongside the one-megabyte HTTP default before a live audit produced 196 items and 804 evidence records. They are not domain or storage constraints. The confirmed onboarding contract now needs count limits of 10,000 items and 10,000 evidence records while retaining a separate route-specific byte limit, authorization, revision checks, idempotency, and one-commit semantics.

The change is a direct usability iteration on `docs/ideas/backlog/conversational-fullwell-onboarding.md`, promoted when the user reported repeated MCP approvals during real onboarding on 2026-07-21 and explicitly approved the read-draft-commit implementation. It remains high-priority because approval fatigue interrupts the first action that makes Fullwell useful. Browser, Chrome, site sign-in, CAPTCHA, and other source-specific consent remain separate and are never implied by the initial Fullwell read.

## Progress

- [x] 2026-07-22T03:27Z: Created and claimed Bead `fullwell-gs8`, read the architecture/specification/prior onboarding plan, and completed product, UX, security, reliability, and eval framing.
- [x] 2026-07-22T03:27Z: Decomposed the work into bounded snapshot, atomic mutation, agent/eval, and release milestones with explicit conflict, payload, recovery, and rollback behavior.
- [x] 2026-07-22T03:31Z: Passed the failure-oriented feature-critic gate after adding snapshot consistency, explicit final confirmation, unique optional section outcomes, legacy skipped-state behavior, a no-empty-commit skip-only path, and pre-confirmation payload checks.
- [x] 2026-07-22T05:42Z: Milestone 1 complete - added the lock-consistent bounded snapshot, strict 24th tool contract, unique final outcomes, and truthful MCP annotations.
- [x] 2026-07-22T05:42Z: Milestone 2 complete - implemented canonical one-commit finalization, skip-only no-Git finalization, exact replay binding, and recovery-worker application of bounded skip intent.
- [x] 2026-07-22T05:42Z: Milestone 3 complete - updated the shared Codex/Claude skills, package `1.1.3`, reference contract, and 32-case eval matrix to keep drafts in the active conversation and write only after final confirmation.
- [x] 2026-07-22T05:49Z: Built and checksum-verified the Linux/amd64 OCI index, deployed `hfj-staging:onboarding-20260721-1-runtime`, retained `hfj-staging:mcp-meta-20260721-1-runtime` as rollback, and passed public readiness, deployment, and MCP discovery smokes at schema `0007`.
- [x] 2026-07-22T05:52Z: Re-ran the required screencast command; Homebrew FFmpeg 8.0.1 rejected its Linux-only `x11grab` input with code 234, so no MP4 was produced.
- [x] 2026-07-22T05:58Z: Published immutable `@fullwell/fullwell@1.1.3`, matched the prepared registry checksum, passed downloaded Codex/Claude lifecycle tests, and updated both current host installations to enabled `fullwell@fullwell` version `1.1.3`.
- [x] 2026-07-22T05:58Z: From the separate `fullwell-tester` folder, current Codex on `gpt-5.6-sol` made exactly one Fullwell call (`hfj_get_context`), no Fullwell mutation, and asked the snack question without the generic "what's on your mind" reply; the transcript filter retained only tool identity and boolean response checks.
- [x] 2026-07-22T06:12Z: Replaced unexplained snack/recipe setup labels with benefit-first guidance and concrete restocking/recipe-recall examples, updated the client specification and eval invariants, prepared package `1.1.4`, and passed package validation plus isolated Codex and Claude lifecycles.
- [x] 2026-07-22T06:34Z: Published immutable `@fullwell/fullwell@1.1.4`, matched the prepared registry checksums, passed downloaded Codex/Claude lifecycle tests, updated both current hosts to enabled version `1.1.4`, and verified the benefit-first snack copy in a sanitized separate-folder current-Codex smoke with no Fullwell mutation.
- [x] 2026-07-22T06:50Z: Made grocery order listings discovery-only in the shared browser audit, required every qualifying order detail and complete-item expansion, added a cross-host incomplete-summary eval, prepared package `1.1.5`, and passed skill validation, the 33-case eval matrix, package validation, isolated host lifecycles, dry-run packing, and full repository verification.
- [x] 2026-07-22T17:13Z: Milestone 4 complete - exposed the stable authenticated user ID, bundled the identity/snapshot-bound local checkpoint runtime, updated shared Codex/Claude orchestration and privacy guidance, expanded to 35 eval cases, and passed eight package/lifecycle tests, 29 browser tests with seven intentional skips, dry-run package inclusion, and full repository verification.
- [x] 2026-07-22T17:44Z: Milestone 5 complete - pushed commit `917c7bc`, deployed the stable-user-ID server image with a retained rollback, published checksum-matched `@fullwell/fullwell@1.1.5`, upgraded both current hosts, and passed deployed, downloaded-package, and fresh-session local checkpoint resume/cleanup smokes with zero Fullwell mutations.
- [x] 2026-07-22T19:55Z: Reframed the live 196-item/804-evidence failure with UX, security, architecture, reliability, and eval lenses; traced the effective limit to onboarding schema caps plus the global one-megabyte parser rather than a domain constraint.
- [x] 2026-07-22T19:55Z: Passed the Milestone 6 feature-critic gate after adding route-specific parser scope, duplicate-item rejection, pre-commit repository-capacity checks, argument-vector-safe Git staging, exact/over-limit tests, response-size observation, and an explicit no-live-bulk-write rule.
- [x] 2026-07-22T20:06Z: Milestone 6 complete - raised only onboarding to 10,000 items and 10,000 evidence records, limited `POST /mcp` to 16 MiB while retaining the one-megabyte default elsewhere, added pre-Git capacity and argument-safe staging, prepared shared package `1.1.6`, and passed contract, server, security, load, eval, package, browser, and full repository gates.

## Surprises & Discoveries

- 2026-07-21: Codex tool approval is host-owned. A plugin cannot grant itself a temporary onboarding approval lease, so Fullwell must reduce its own call count and truthfully annotate tool effects rather than trying to suppress host safety policy.
- 2026-07-21: The current audit path intentionally commits evidence before conclusions, which creates at least two Git writes per section. A one-write onboarding path must validate newly submitted evidence and conclusions together without weakening the evidence-first semantic rule.
- 2026-07-21: Per-user skip state is Neon operational data, while completed state is derived from canonical Git reports. A mixed complete/skip finalization therefore crosses the existing Git and Neon recovery boundary and must retain bounded recovery intent in the mutation record.
- 2026-07-21: A complete existing-item corpus is not safe to embed in `hfj_get_context`. The snapshot must expose only bounded identity summaries and signal truncation; ambiguous existing-item conflicts may require an additional read rather than silently merging.
- 2026-07-22: The initial implementation exposed the generic mutation runner's historical completed-replay behavior, which did not compare a changed payload after success. The new final onboarding tool now retains and checks its request fingerprint on completed replay without changing legacy tool behavior.
- 2026-07-22: Adding the combined boundary initially reduced repository branch coverage from 90.07% to 89.58%. Contract and service edge tests for empty/duplicate input, no-household snapshots, invalid completion/skip, stale HEAD, changed replay, and unchanged skips restored the enforced gate to 90.03%.
- 2026-07-22: The authorized context exposed only the user's display name. Safe local sharding requires the stable authenticated Fullwell user ID, so the read response must add that non-secret identifier before a draft can be resumed.
- 2026-07-22: Conversation-only state did not survive compaction or a closed chat during long browser audits. A bounded local checkpoint solves that failure without adding another canonical Fullwell write, provided stale snapshots and concurrent local writers fail closed.
- 2026-07-22: The live Codex smoke showed that ad hoc shell construction of the helper's stdin JSON is error-prone. The packaged lifecycle and runtime tests cover the boundary, but future client ergonomics should provide a host-native wrapper so an agent never needs to recover a hidden identifier by inspecting the draft root; the successful release smoke ultimately loaded and deleted only the context-bound shard.
- 2026-07-22: A real grocery audit produced 196 items and 804 evidence records, proving the original 100/500 caps were below normal user data. The actual coupled constraints are the one-megabyte global HTTP parser, the 16 MiB local checkpoint, Git's 10,000-file reconciliation guard, and argument-vector growth when staging thousands of paths.
- 2026-07-22: The compact 10,000-item/10,000-evidence service fixture commits and exactly replays in about 0.6 seconds in the full deterministic suite. A real isolated Git repository commits 20,000 onboarding paths in under nine seconds without process argument expansion, so no live household bulk write was needed for acceptance evidence.

## Decision Log

- 2026-07-22: Supersede the conversation-only draft decision. Store a versioned JSON checkpoint under `~/.codex/fullwell/drafts/<user-id>/<household-id>/onboarding.json`, or the active Codex home equivalent, with `0700` directories and `0600` atomic files. The user explicitly accepts that another person with access to the same operating-system account can read it; the required boundary is preventing accidental Fullwell user or household mixing, not encryption at rest.
- 2026-07-22: Bind every checkpoint to the authenticated Fullwell user ID, household ID, repository HEAD, both onboarding revisions, and a local draft revision. Never scan another identity shard, merge a stale checkpoint, or store credentials, cookies, browser state, access tokens, refresh tokens, or raw page captures.
- 2026-07-22: Delete the matching checkpoint after a confirmed commit or explicit whole-flow cancellation. Expired, malformed, mismatched, or concurrent-write-conflicted checkpoints fail closed and leave canonical Fullwell state unchanged.
- 2026-07-21: Extend `hfj_get_context` instead of adding another initial-read tool. One selected-household response can safely carry profiles and a bounded item index after the existing membership check.
- 2026-07-21: Add one purpose-specific `hfj_commit_onboarding` tool rather than broadening `hfj_commit_change_set`. The new contract can require section outcomes, bound the combined payload, and coordinate per-user operational skip state without changing ordinary journal updates.
- 2026-07-21: A `complete` section outcome is accepted only when the same request writes the matching canonical report or the report already exists. The agent still cannot persist an independent completion flag.
- 2026-07-21: Preserve `hfj_update_onboarding` for backward compatibility and resumable older clients, but the new shared skills do not call it during an ordinary read-draft-commit run.
- 2026-07-21: Treat one Fullwell read and one Fullwell write as the target, not an absolute promise across every household. Truncated item indexes, stale HEADs, payload limits, authorization changes, or explicit conflict resolution fail closed and may require another user-approved read or retry.
- 2026-07-21: Represent only changed section outcomes in a unique bounded array. Already-complete sections and an unchanged prior skip are omitted; completing a previously skipped section needs the canonical report but no synthetic `resume` write.
- 2026-07-21: A final skip-only request with no canonical file changes completes as one Neon operational mutation against the current HEAD. It never creates an empty Git commit or stores per-user skip state in the shared household repository.
- 2026-07-22: Raise only `hfj_commit_onboarding` to 10,000 evidence and 10,000 items; keep ordinary append/change-set batch sizes unchanged. Give `/mcp` a 16 MiB route-specific body limit matching the local checkpoint while retaining the one-megabyte default everywhere else. Raise the full-repository reconciliation guard only enough to contain one maximum fresh onboarding commit plus system files, and stage the isolated mutation worktree without enumerating every path in the process argument vector.

## Context and Orientation

`packages/contracts/src/tools.ts` owns the stable MCP tool union and strict input schemas. `packages/contracts/src/onboarding.ts` owns section states and bounded skip reasons. `apps/server/src/http/app.ts` publishes tool metadata. It currently publishes names, descriptions, and input schemas without MCP tool annotations.

`apps/server/src/services/household-food-journal.ts` implements `hfj_get_context`, profile/item reads, evidence append, change-set commits, and per-user onboarding transitions. `apps/server/src/services/mutation-runner.ts` owns the signed Git commit and durable mutation-state lifecycle. `apps/server/src/core/ports.ts`, `apps/server/src/core/types.ts`, `apps/server/src/adapters/memory.ts`, `apps/server/src/persistence/neon-operational-store.ts`, and `apps/server/src/workers/reconciliation-worker.ts` own operational state, projections, and recovery.

The shared host behavior lives in `packages/agent-client/skills/manage-household-food-journal/SKILL.md`, `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`, and `packages/agent-client/skills/track-recipe-history/SKILL.md`. `packages/agent-client/runtime/onboarding-draft.mjs` owns the local checkpoint boundary and is bundled for both hosts. `packages/agent-client/evals/cases/v1.json`, `packages/agent-client/evals/expected/v1.json`, and `packages/agent-client/tests/evals/matrix.test.mjs` make tool order and forbidden behavior deterministic across Codex and Claude.

Assumptions and constraints:

- The normal acceptance path begins with an existing editable household whose item index is not truncated and whose combined onboarding payload fits the `/mcp` route's 16 MiB body limit. The 10,000-record count limits do not override per-field schemas or this independent byte bound.
- The initial read does not authorize browsing. Each source and browser remains explicitly user-authorized.
- Draft answers and bounded evidence are local and resumable until final user confirmation. A stopped or abandoned conversation performs no Fullwell write; a matching, current checkpoint can resume after host context loss.
- Git remains authoritative for evidence, items, profiles, and reports. Neon remains authoritative for per-user skipped state and mutation recovery metadata.
- Programs validate evidence relationships, revisions, report arithmetic, and allowed paths but do not classify foods, resolve semantic identity, or author report prose.
- One successful finalization creates one signed Git commit when canonical files change. A skip-only finalization uses one operational transaction against the current HEAD and never creates an empty Git commit or a private per-user Git document.

## Framing Notes

### Expert panel

- UX expert - minimize approval fatigue without hiding the final consequential write.
- Security and privacy researcher - preserve source consent and keep sensitive drafts out of unmanaged local files.
- Staff architect - combine existing evidence/profile/report behavior without weakening Git authority or multiplying tools.
- Reliability engineer - make mixed Git and Neon outcomes replayable across crashes, retries, and stale hosts.
- Applied ML and eval engineer - keep semantic decisions in the host model and prove the two-call orchestration across both hosts.

### What problem are we actually solving?

The problem is not merely the number of tool calls. It is that Fullwell persists workflow bookkeeping while the user is still answering questions, forcing the host to request approval before the user has reached a meaningful decision. The workflow should remain a reversible draft until the user reviews one complete result.

### Roundtable highlights

- UX: read once, ask uninterrupted questions, preview the intended changes, then request one clearly labeled final write.
- Security/privacy (superseded by the 2026-07-22 user decision): never interpret the initial read as permission to inspect browser sources. The selected local checkpoint deliberately favors resumability and identity separation over encryption from another person using the same operating-system account.
- Architecture: submit new evidence and the conclusions citing it in the same typed request, validate against a combined existing-plus-new evidence map, and commit all canonical changes once.
- Reliability: bind the final request to the snapshot HEAD, item revisions, onboarding revisions, and an idempotency key; persist bounded skip recovery intent before the Git boundary.
- ML/evals: forbid `hfj_update_onboarding`, profile writes, evidence appends, and change-set writes before final confirmation in the normal onboarding eval.

### Key tensions

- Fewer approvals versus persistent cross-session progress.
- One final payload versus the one-megabyte request boundary and large purchase histories.
- Ten-thousand-record count support versus bounded parser memory, Git process arguments, repository reconciliation, and the 1 GiB staging host.
- Atomic canonical Git content versus per-user operational skip state.
- Bounded context snapshots versus complete semantic duplicate review.

### Synthesis for decomposition

Prove the combined contract and validation first. Then integrate recovery and one-commit persistence. Only after the server boundary passes race/replay tests should the shared skills stop making intermediate mutations. Roll out the server before publishing the client, retain old tools through the compatibility window, and verify the exact current Codex host call sequence against staging.

For the 10,000-record correction, the UX lens requires one final approval to cover a real audit rather than forcing artificial partial saves. The security lens requires a route-specific byte ceiling instead of globally accepting large bodies. The reliability lens requires exact-limit and over-limit tests plus a Git staging path that does not depend on operating-system argument limits. The architecture lens keeps the ordinary mutation tools small and changes only the onboarding aggregate. The eval lens requires both hosts to treat a within-limit large draft as one final write, not as permission to split or pre-write it.

## Milestones

### Milestone 1 - Snapshot, commit contract, and tool metadata

Files:

- `packages/contracts/src/onboarding.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`

Tasks:

1. Define strict section-outcome and combined onboarding finalization schemas using the existing evidence, item, report, profile, HEAD, item-revision, onboarding-revision, and idempotency types.
2. Bound combined evidence/items/reports/profiles so the normal request fits the existing HTTP limit; reject empty finalizations, duplicate sections, impossible completion claims, and malformed recovery intent.
3. Extend selected-household `hfj_get_context` output with snack/recipe profiles and a bounded item identity index plus a `truncated` signal. Under the household lock, require repository HEAD, household projection HEAD, and membership projection HEAD to agree before returning the snapshot. Do not return it before membership authorization.
4. Publish truthful MCP annotations for read-only, idempotent, destructive, and open-world behavior. Keep the annotation mapping explicit for security-sensitive tools.
5. Raise the stable catalog to 24 tools while retaining `hfj_update_onboarding` for old clients.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- http/app.test.ts services/household-food-journal.test.ts`
- `npm run typecheck --workspace @hfj/server`

### Milestone 2 - Recoverable one-write finalization

Files:

- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/mutation-runner.ts`
- `apps/server/src/workers/reconciliation-worker.ts`
- `apps/server/src/core/types.ts`
- `apps/server/src/adapters/memory.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/workers/reconciliation-worker.test.ts`
- `tests/load/concurrency.test.ts`
- `tests/security/boundaries.test.ts`

Tasks:

1. Validate new evidence IDs and corrections against existing plus same-request evidence, then validate item evidence and report assertions against the combined prospective state.
2. Build one repository change list for evidence, item documents, canonical reports, and changed snack/recipe profiles; reject duplicate paths, duplicate section/profile entries, and a `complete` outcome without its report.
3. Run the finalization through the household lock and existing mutation states: `received`, `locked`, `git_committed`, `projections_applied`, and `completed`.
4. Persist only bounded recovery metadata for per-user skip outcomes before the Git boundary. On retry or reconciliation, apply each skip compare-and-set idempotently and never expose internal recovery fields in MCP output. If the request has no canonical changes, finish the same durable mutation and skip compare-and-sets inside one household-scoped Neon transaction using the unchanged current HEAD.
5. Reject stale household HEAD, stale item or onboarding revision, viewers, changed idempotency payloads, duplicate evidence, oversized input, and a concurrent member update without a partial success response.
6. Return final derived onboarding status in the write response so the client needs no follow-up read.

Verification:

- `npm run test --workspace @hfj/server -- services/household-food-journal.test.ts workers/reconciliation-worker.test.ts`
- `npm run test:contract`
- `npm run test:security`
- `npm run test:load`

### Milestone 3 - Shared conversational draft and evals

Files:

- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Make one `hfj_get_context` snapshot the only normal Fullwell read before finalization. Reuse its profiles and item summaries without calling profile/search/item tools unless the snapshot explicitly reports a truncation or ambiguity.
2. Keep source answers, evidence, semantic decisions, profile edits, reports, and bounded skip reasons in the identity-sharded local checkpoint. Do not write a workspace draft, opt the draft into host memory, or treat the checkpoint as canonical household state.
3. Before asking for confirmation, ensure the draft is within the advertised evidence/item/report/profile and request-size bounds. Ask the user to review a concise final summary and explicitly confirm the write, then call `hfj_commit_onboarding` exactly once. Do not call `hfj_update_onboarding`, `hfj_update_profile`, `hfj_append_evidence`, or `hfj_commit_change_set` during the normal draft.
4. Preserve snack-before-recipe order, natural section decline, explicit whole-flow stop, browser/source authorization, semantic food rules, and no false completion.
5. Add cross-host evals for two-call success, mixed complete/skip, skip-only finalization, explicit stop with zero writes, stale final commit, truncated inventory, oversized draft, and no intermediate mutation.
6. Prepare the next immutable package version and validate both host lifecycle adapters from the packed artifact.

Verification:

- `npm run test:evals`
- `npm run test:packaging`
- `npm run build --workspace @fullwell/fullwell`

### Milestone 4 - Identity-sharded local checkpoint

Files:

- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `packages/agent-client/runtime/onboarding-draft.mjs`
- `packages/agent-client/tests/packaging/onboarding-draft.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/evals/`

Tasks:

1. Add the stable authenticated Fullwell user ID to `hfj_get_context.user` and verify that each principal receives only its own ID after the existing authorization boundary.
2. Bundle a dependency-free Node checkpoint helper with a strict versioned JSON boundary, safe opaque-ID path derivation, a bounded payload, 30-day expiry, atomic same-directory rename, `0700` directories, `0600` files, exact snapshot matching, and optimistic local draft revisions.
3. Load only the exact current user/household shard after `hfj_get_context`. Ignore malformed, expired, identity-mismatched, HEAD-mismatched, or onboarding-revision-mismatched data; never search sibling shards or merge stale content.
4. Save after meaningful audit progress without making a Fullwell mutation. Delete after a successful `hfj_commit_onboarding` response or explicit whole-flow cancellation, but retain it after uncertain, failed, or conflicted remote writes so recovery remains possible.
5. Add deterministic helper tests and cross-host eval assertions for resume, isolation, stale/corrupt failure, concurrent local writers, cleanup, package inclusion, and prohibited credential/browser-state persistence.

Verification:

- `npm run test --workspace @hfj/server -- services/household-food-journal.test.ts`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`

### Milestone 5 - Documentation, rollout, and live evidence

Files:

- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/ideas/backlog/conversational-fullwell-onboarding.md`
- `CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/release/verification-evidence.md`

Tasks:

1. Document local identity-sharded drafts, bounded snapshots, one final write, payload/conflict fallbacks, annotations, authority, recovery, and compatibility.
2. Run doc-drift review and refresh generated knowledge only when the tracked tree or quality ledger requires it.
3. Capture the changed conversation flow with `npm run capture:screencast -- --output artifacts/screencasts/approval-efficient-onboarding.mp4`; if the host capture dependency remains unavailable, record the exact blocker and retain redacted host transcript evidence.
4. Run the complete local gate set, commit with the required `AI-Model` trailer, push, publish the immutable client package, and deploy an amd64 server image with the previous runtime as rollback.
5. Through a separate test folder and current Codex account, verify one initial Fullwell read, no intermediate Fullwell mutation, one final write only after explicit confirmation, derived completion, and no returned private values in the evidence transcript.

Verification:

- `npm run test:e2e`
- `npm run test:integration`
- `npm run test:security`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `STAGING_BASE_URL=https://fullwell.souschefstudio.com npm run test:deploy-smoke -- staging`
- `STAGING_BASE_URL=https://fullwell.souschefstudio.com npm run test:mcp-smoke -- staging`

### Milestone 6 - Real-history onboarding capacity

Files:

- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/git/git-repository.ts`
- `apps/server/src/git/git-repository.test.ts`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/RELIABILITY.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Replace the onboarding-only item/evidence caps with named 10,000-record contract limits and reject 10,001 deterministically. Preserve ordinary evidence and change-set batch limits.
2. Raise only the MCP POST body parser to 16 MiB, matching the existing local checkpoint ceiling; retain the one-megabyte default for every other route and preserve generic, non-enumerating 413 behavior.
3. Reject duplicate item IDs at the contract boundary. Before writing, count the current tree plus distinct new paths and fail before Git when the resulting household would exceed the full-repository reconciliation ceiling. Let one maximum fresh onboarding mutation create more than 20,000 canonical paths without exceeding that ceiling or the operating system's argument-vector limit. Keep path validation, append-only evidence, signed commits, and rollback unchanged.
4. Add exact-limit, over-limit, above-one-megabyte HTTP, atomic service, replay, pre-commit repository-capacity, and bounded Git tests. The large success fixture must serialize below 16 MiB, produce one commit, and record the response size and elapsed time without logging content.
5. Teach both hosts that a confirmed draft within the 10,000/10,000 and 16 MiB bounds uses one `hfj_commit_onboarding` call; an over-count or over-byte draft remains local and reports the precise blocking bound without intermediate writes.
6. Update normative specs, reliability guidance, changelogs, implementation evidence, and the package version; run narrow gates before full verification and release.

Feature-critic constraints:

- The 16 MiB override applies only to `POST /mcp`; the global and direct HTTP tool defaults remain one megabyte so this change does not widen unrelated browser, OAuth, webhook, or tool routes.
- Count limits and byte limits are independent. Compact 10,000/10,000 fixtures must succeed, but maximum-length fields may hit 16 MiB first and must fail before service dispatch.
- A repository-capacity failure happens before the signed commit. A successful commit must never leave a tree that the reconciliation worker refuses to read.
- Duplicate item or evidence paths fail before Git, and staging uses the isolated worktree rather than passing 20,000 paths through `argv`.
- Do not drive a synthetic maximum-size write against the user's live household. Deployment smoke may exercise parser/tool discovery; deterministic and isolated Git tests own bulk-mutation evidence.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- http/app.test.ts services/household-food-journal.test.ts git/git-repository.test.ts`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:load`
- `npm run test:security`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Interfaces and Dependencies

The public input is conceptually:

```ts
type OnboardingOutcome =
  | { section: "snacks" | "recipes"; outcome: "complete"; expected_revision: number }
  | { section: "snacks" | "recipes"; outcome: "skip"; reason: "not_now" | "no_sources" | "user_declined"; expected_revision: number };

interface CommitOnboardingInput {
  household_id: HouseholdId;
  expected_head: GitObjectId;
  idempotency_key: IdempotencyKey;
  sections: OnboardingOutcome[]; // unique by section; omit unchanged sections
  profiles: Array<{ profile: "snacks" | "recipes"; markdown: string }>;
  evidence: Evidence[];
  items: JournalItem[];
  reports: Report[];
  expected_item_revisions: Record<ItemId, GitObjectId>;
}
```

The exact schema uses unique section and profile lists so unchanged state is omitted while every persisted outcome remains explicit. `hfj_get_context` returns the stable authenticated user ID, one consistent HEAD, profile markdown/revisions, section revisions, and bounded item identity summaries needed to bind the local checkpoint and construct this request. If a section was already skipped and is declined again, the client omits it unless another canonical/profile change must be committed; a same-request canonical report makes it complete without an operational resume transition.

## Idempotence and Recovery

- The idempotency key binds to a stable fingerprint of the complete final payload. Changed reuse fails with `REVISION_CONFLICT` before any new write.
- The final tool writes all canonical files in one signed Git commit under the expected HEAD. Git path validation and append-only evidence rules remain unchanged.
- A skip-only request with no canonical changes compares the expected HEAD and section revisions, commits the skip rows plus completed idempotency response in one Neon household transaction, and records the unchanged HEAD as its replay anchor.
- The mutation record retains only the request fingerprint and bounded skip recovery intent, never raw source evidence or profile/report prose beyond what is canonical in Git.
- If Git succeeds but projections or skip compare-and-set fail, the request enters `reconciliation_required`. Exact retry or the reconciliation worker rebuilds Git projections and reapplies the bounded skip intent before completion.
- If the host loses the response after completion, exact retry returns the recorded response without another commit or onboarding transition.
- Local checkpoint writes compare a monotonically increasing draft revision and atomically replace a private file. Failed or uncertain remote writes retain the exact checkpoint and idempotency key; confirmed success and explicit cancellation delete only the matching current revision.
- The prior server and client remain compatible because existing tools are retained. Rollback disables the new client first, restores the previous server image second, and leaves any successfully committed canonical content valid.

## Acceptance / Verification

- A fresh editable household's `@Fullwell hi` path uses one `hfj_get_context` read, asks snack then recipe questions, and makes no Fullwell mutation before final confirmation.
- The client verifies payload bounds, shows a bounded summary of intended profile, evidence, report, and skip changes, and obtains explicit confirmation before the write.
- One `hfj_commit_onboarding` call persists the ordinary completed run and returns final derived section status without a follow-up read.
- One `hfj_commit_onboarding` call accepts as many as 10,000 items and 10,000 evidence records when the complete MCP envelope is at most 16 MiB; 10,001 records or an oversized body fails before mutation.
- A natural snack or recipe decline stays local during the conversation and is persisted as a bounded per-user skip only in the final call; an explicit whole-flow stop performs no write.
- A closed conversation resumes only a local draft matching the current authenticated user, household, repository HEAD, and both onboarding revisions; stale, malformed, expired, mismatched, and concurrently superseded drafts fail closed.
- Browser/source authorization remains explicit and separate from Fullwell tool approval.
- New evidence may support same-request item and report conclusions, but missing, duplicate, or arithmetically inconsistent evidence fails validation.
- Stale HEAD/item/onboarding revisions, changed idempotency payloads, viewers, cross-household substitution, truncated duplicate context, oversized payloads, and crash-after-commit recovery fail closed without duplicate Git commits or false completion.
- Current and previous clients remain compatible during rollout; tool annotations truthfully distinguish reads, ordinary writes, and destructive actions.
- Contract, server, reconciliation, load, security, eval, packaging, browser, integration, full verification, deployment smoke, and live current-host evidence pass.
- Screencast command: `npm run capture:screencast -- --output artifacts/screencasts/approval-efficient-onboarding.mp4`.

## Outcomes & Retrospective

The live implementation now has one lock-consistent `hfj_get_context` read, no intermediate Fullwell mutation, a user/household/snapshot-bound local checkpoint, one explicit final summary/confirmation, and one `hfj_commit_onboarding` write. Public `@fullwell/fullwell@1.1.5` carries the same helper and behavior for Codex and Claude. Skip-only confirmation leaves Git unchanged; canonical changes create one commit; exact replay does not create another commit; changed replay conflicts; post-Git skip failure is recovered from bounded metadata.

Local evidence for the published `1.1.5` baseline passes 279 deterministic tests with 11 database-gated skips, the 11 PostgreSQL integration tests separately through Apple Container, 29 browser tests with seven intentional project skips, 35 cross-host eval cases, eight package/lifecycle tests, migrations up/down/up, security/load/contract gates, the full repository verification, and 96.47% statement/line, 94.85% function, and 90.03% branch coverage. The prepared `1.1.6` correction independently bounds one onboarding request at 10,000 evidence records, 10,000 unique items, two reports, two profiles, two section outcomes, and a route-specific 16 MiB MCP body limit while retaining the one-megabyte default elsewhere. A 200-item snapshot truncation, stale state, ambiguity, or oversized draft may require additional approved reads; a draft within the final count and byte bounds must not be split into intermediate writes.

The `1.1.6` correction passes 284 deterministic tests with 11 expected database-gated skips, the focused contract/server/security/load suites, 29 browser tests with seven intentional project skips, 36 cross-host eval cases, and eight package/lifecycle tests. Its compact maximum-count service fixture commits and replays exactly once in about 0.6 seconds, and an isolated real Git repository stages and commits 20,000 paths in under nine seconds. The release remains prepared locally; this milestone does not claim an npm publication, Git push, or staging deployment.

Staging now runs `hfj-staging:onboarding-drafts-20260722-1-runtime` with Linux/amd64 OCI index digest `sha256:b88f85a3c3108708498e46275181d7b75ec68f5254db86b39213c30c9abf25b0` from checksum-matched archive SHA-256 `569952d091e96e3dba0503a534580f1d497280be539f7d2eefe5297c93bc7ae3`. Public live/readiness, deployment, and OAuth/MCP discovery smokes pass at schema `0007`; `hfj-staging:onboarding-20260721-1-runtime` and the pre-release environment backup remain available for rollback.

Public immutable package `@fullwell/fullwell@1.1.5` has registry SHA-1 `2142c869f01933a79dc458aa137136a7ca6f584a` and SHA-512 `sha512-aizf/lfRTYIcFHDD7mfXK89Q9I0vcNcPkl+QzDy6CbkoMi0da3s4gfBtg9oswUoMRRByBgvCfUNDXrnQemuoyg==`, matching the prepared artifact. `latest` resolves to `1.1.5`, the downloaded package passes all eight package/lifecycle checks, and current Codex and Claude both report enabled `fullwell@fullwell` version `1.1.5`.

Fresh `gpt-5.6-sol` sessions from the separate `fullwell-tester` folder prove the deployed response contains a stable user ID, a bounded checkpoint can be saved with zero Fullwell mutations, another conversation resumes the same marker and deletes the matching revision, and a final exact-shard load reports it missing. The transcript retains only booleans and mutation counts. A real final-confirmation write was intentionally not driven automatically because it would change the user's household based on invented onboarding answers; deterministic and PostgreSQL tests cover that atomic write. The required screencast was attempted and failed because the macOS FFmpeg build does not provide `x11grab`; no MP4 is claimed.
