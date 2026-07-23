# Approval-Efficient Fullwell Onboarding

## Purpose / Big Picture

Fullwell onboarding must provide value before requiring an account. A fresh installation first asks whether the person already has a Fullwell account. Existing account holders use the current OAuth and hosted-household path. Everyone else completes grocery-history and recipe onboarding against a durable local guest household without any Fullwell MCP call, can use that local data for direct restocking and recipe recall, and is offered optional cloud backup only after collection. Creating an account remains required for WhatsApp, collection sharing, and multiplayer access. The existing hosted path still uses one membership-authorized snapshot, a local checkpoint, and one final `hfj_commit_onboarding` write.

The final write must also fit real grocery histories. The original 100-item and 500-evidence limits were conservative schema guards chosen alongside the one-megabyte HTTP default before a live audit produced 196 items and 804 evidence records. They are not domain or storage constraints. The confirmed onboarding contract now needs count limits of 10,000 items and 10,000 evidence records while retaining a separate route-specific byte limit, authorization, revision checks, idempotency, and one-commit semantics.

The change is a direct usability iteration on `docs/ideas/backlog/conversational-fullwell-onboarding.md`, promoted when the user reported repeated MCP approvals during real onboarding on 2026-07-21 and explicitly approved the read-draft-commit implementation. It remains high-priority because approval fatigue interrupts the first action that makes Fullwell useful. Browser, Chrome, site sign-in, CAPTCHA, and other source-specific consent remain separate and are never implied by the initial Fullwell read.

## Progress

- [x] Milestone 10 - correct cross-host plugin-root resolution and require a healthy local MCP connection.
- [x] 2026-07-23T02:54Z: Live host smoke after installing public `1.1.9` proved Codex connected to both Fullwell servers but Claude only discovered `fullwell-local` and failed to start it. Created and claimed Bead `fullwell-gs8.15`; the published package remains immutable and the correction will ship as `1.1.10`.
- [x] 2026-07-23T03:04Z: Milestone 10 complete locally - prepared `1.1.10` with equivalent Codex and Claude path adapters, real-path-safe stdio startup, a Claude `Connected` lifecycle assertion, and synchronized package, architecture, product, changelog, and reliability evidence.
- [x] 2026-07-23T03:04Z: Passed all 20 package/lifecycle tests, the 45-case cross-host eval matrix, official Claude manifest validation, 29 WebKit checks with seven intentional skips, and full repository verification with 289 deterministic application tests and 11 expected database skips. The 21-entry dry pack has SHA-1 `58b0bd7fed9d69412461e6cd7323d2d5324628b0` and SHA-512 `sha512-WIquteSMO0Mun9i7J/twve3Fxd34XhrI0I58yWgJ8wiIyDnYaF3M+5FbSMzjE+jx7H4FTdInHqDV+9Nmo48ORQ==`; publication and current-host upgrade are not yet claimed.
- [x] 2026-07-23T03:08Z: Pushed correction commit `ac4e231`, published immutable public `@fullwell/fullwell@1.1.10` as npm `latest`, matched registry checksums to the prepared artifact, passed both lifecycles from a clean registry install, and upgraded current Codex and Claude to enabled `1.1.10`. Current Claude reports the installed `fullwell-local` server as `Connected`; no application-server deployment was necessary.
- [x] Milestone 9 - replace version-specific local helper commands with a stable host-native local tool boundary.
- [x] 2026-07-23T02:27Z: Created and claimed Bead `fullwell-gs8.14`; traced the repeated approval to the immutable plugin cache path changing on every release and confirmed that Codex npm plugin installs intentionally do not run lifecycle scripts.
- [x] 2026-07-23T02:27Z: Completed the Milestone 9 failure-oriented critique. The implementation must use stable server/tool identities rather than a mutable self-installed executable, keep load/update/delete approval semantics separate, remain dependency-free and offline, preserve the existing bounded runtime, fail closed when the local server is unavailable, and prove both host lifecycle compatibility.
- [x] 2026-07-23T02:40Z: Milestone 9 complete locally - prepared package `1.1.9` with the plugin-provided `fullwell-local` stdio server, stable read/update/delete tool identities, truthful approval annotations, fail-closed skill routing, and isolated Codex and Claude discovery coverage.
- [x] 2026-07-23T02:40Z: Passed 20 package/lifecycle tests, the 45-case cross-host eval matrix, package validation, 29 WebKit checks with seven intentional skips, and full repository verification with 289 deterministic application tests and 11 expected database skips. The 20-entry dry pack has SHA-1 `a9f9474924de809d4df879ee81ff11260ca423b2` and SHA-512 `sha512-iS8nSYRT8c4520KM6XwyHMxG7Fz2HB18ghTsaQexkl2I8otY9IEeFRoUuzkPuMgDRsYsWQOWvnE9HXywXGGHBg==`; no commit, publication, host upgrade, or server deployment is claimed.
- [x] 2026-07-23T02:51Z: Pushed implementation commit `cbc16c9`, published immutable public `@fullwell/fullwell@1.1.9` as npm `latest`, matched the registry SHA-1 and SHA-512 to the prepared artifact, and passed isolated Codex and Claude lifecycles from a clean registry install with both MCP servers discovered. The server application was unchanged and was not redeployed.
- [x] Milestone 8 - make new-user onboarding local-first before OAuth, preserve direct local utility, and promote to cloud only after an explicit backup choice.
- [x] 2026-07-22T23:58Z: Milestone 8 complete locally - added the private revisioned guest-household runtime, routed fresh and resumed conversations without pre-consent MCP calls, preserved direct local grocery/recipe use, made cloud backup an explicit non-destructive promotion, prepared package `1.1.8`, and synchronized install, architecture, security, reliability, product, changelog, and privacy guidance.
- [x] 2026-07-22T23:58Z: Passed seven local-runtime tests, the 44-case cross-host eval matrix, all 15 packaging/lifecycle tests, package build, 289 deterministic application tests with 11 expected database skips, and 29 WebKit checks with seven intentional skips. The final dry pack contains 19 entries with SHA-1 `f88bc7c0623a51956e9c5db2cea186a2d4dfeb0c`; no commit, publication, host upgrade, or server deployment is claimed.
- [x] 2026-07-22T23:58Z: Attempted `artifacts/screencasts/local-first-fullwell-onboarding.mp4`; Homebrew FFmpeg 8.0.1 rejected the helper's Linux-only `x11grab` input with code 234, so no MP4 was produced.
- [x] 2026-07-23T00:05Z: Added Bead `fullwell-gs8.12` and a success-gated completion handoff that invites one concrete out-of-stock restocking request after local finalization or hosted commit, names learned product/store history, preserves cart confirmation, and stays absent after unsuccessful or no-grocery runs.
- [x] 2026-07-23T00:07Z: Passed the 44-case cross-host eval matrix, all 15 package/lifecycle tests, package validation, documentation and ExecPlan gates, and the complete repository verification with 289 application tests and 11 expected database skips. The first full run reported an unrelated post-test local-runner `EPIPE`; its isolated two-test rerun and the complete verification rerun passed without code changes.
- [x] 2026-07-23T01:55Z: Pushed implementation commit `cade45e`, published immutable public `@fullwell/fullwell@1.1.8` as npm `latest`, matched the prepared SHA-1 and SHA-512 against registry metadata, and passed isolated Codex and Claude lifecycles from a clean registry install. The server was unchanged and was not redeployed.
- [x] 2026-07-22T23:12Z: Passed the Milestone 8 failure-oriented feature-critic gate after requiring remembered guest routing, zero remote discovery calls, durable direct local utility, semantic reconciliation for non-empty hosted households, non-destructive failed promotion, exact-retry binding, forbidden local-data checks, and rollback-readable local state.
- [x] 2026-07-22T23:06Z: Created and claimed Bead `fullwell-gs8.11`; reframed the primary install journey around local value before account creation and decomposed the guest runtime, shared skill routing, cloud promotion, eval, packaging, and documentation work.
- [x] 2026-07-22T22:34Z: Pushed commit `681952e`, deployed checksum-matched Linux/amd64 image `hfj-staging:whole-grocery-20260722-1-runtime` with the prior image retained for rollback, published immutable `@fullwell/fullwell@1.1.7`, upgraded both current hosts, and passed public deployment, MCP, registry-integrity, and clean-install lifecycle checks.
- [x] 2026-07-22T21:24Z: Milestone 7 complete locally - mixed grocery kinds, canonical paths, one-pass low-frequency learning, broader runner snapshot/prompt, user messaging, dashboard counts, package `1.1.7`, 39 cross-host eval cases, 300 deterministic tests with 11 expected database skips, and 29 WebKit checks with seven intentional project skips pass.
- [x] 2026-07-22T21:10Z: Framed the grocery-history expansion with UX, semantic-data, privacy, reliability, and eval perspectives; claimed Bead `fullwell-gs8.7` and decomposed one-pass collection, first-class grocery kinds, restocking availability, and compatibility work.
- [x] 2026-07-22T21:10Z: Passed the Milestone 7 feature-critic gate after requiring below-threshold grocery identities, distinct standard/Japanese mayonnaise formulations, canonical item-area validation, legacy purchase-evidence readability, one shared order traversal, and runner-snapshot coverage.
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
- [x] 2026-07-22T20:22Z: Release audit found the newly disclosed `fast-uri` GHSA-v2hh-gcrm-f6hx advisory before deployment; refreshed only the affected transitive lockfile releases, restored zero production vulnerabilities, and discarded the pre-fix image from release consideration.
- [x] 2026-07-22T20:57Z: Pushed commits `b6b12db` and `785ec06`, deployed checksum-matched Linux/amd64 image `hfj-staging:onboarding-capacity-20260722-2-runtime` with the prior image retained for rollback, published immutable `@fullwell/fullwell@1.1.6`, upgraded both current hosts, and passed public deployment, MCP, live parser-boundary, registry-integrity, and clean-install lifecycle checks.

## Surprises & Discoveries

- 2026-07-23: Claude ignores the shared MCP declaration's relative `cwd`, so discovery-only lifecycle assertions allowed `node ./runtime/local-household-mcp.mjs` to pass packaging while failing live connection health. Claude's documented `${CLAUDE_PLUGIN_ROOT}` substitution is the portable MCP path boundary; lifecycle acceptance must assert `Connected`, not merely the server name.
- 2026-07-23: Codex does not expand `${CLAUDE_PLUGIN_ROOT}` in an MCP argument, so one physical MCP config cannot express both current hosts' path semantics without a shell. Two minimal host transport adapters preserve the same server and tool identities without adding shell evaluation. The strengthened lifecycle also exposed that macOS canonicalizes temporary `/var` and `/tmp` paths through `/private`, requiring the server's main-module guard to compare real paths.
- 2026-07-23: A marketplace package cannot safely create `~/.codex/fullwell/bin/local-household-v1` during installation because Codex downloads npm plugin packages without running lifecycle scripts. A plugin-provided local MCP server gives the same upgrade-stable permission boundary through a stable server and tool identity without letting the package modify the user's command allowlist or install mutable executable code outside its cache.
- 2026-07-22: The current local checkpoint cannot serve an unauthenticated person because its path and validity are bound to a Fullwell user ID, household ID, hosted repository HEAD, and hosted onboarding revisions. A guest path needs its own durable local identity and revision boundary rather than fake server identifiers.
- 2026-07-22: Delaying only the final write is insufficient. If the first `hfj_get_context` call remains mandatory, MCP OAuth still precedes all product value. The shared skill must ask the account question before calling any hosted tool.
- 2026-07-22: Local onboarding data must be readable by ordinary direct grocery and recipe requests; otherwise declining cloud backup creates a dead-end artifact rather than a usable local product.
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
- 2026-07-22: The first release image build surfaced a new high-severity `fast-uri` advisory despite the preceding application gates. The immutable artifact was not deployed; updating the three affected transitive lock entries to patched releases restored a zero-vulnerability production audit before rebuilding.

## Decision Log

- 2026-07-23: Resolve the local MCP script through `${CLAUDE_PLUGIN_ROOT}` in the shared manifest and remove dependence on process working directory. Keep the stable server/tool identities unchanged, require both hosts to expand the installed package path, and make Claude lifecycle verification prove the server connects.
- 2026-07-23: Supersede the single-manifest path decision after current Codex proved it does not expand Claude's placeholder. Use `codex-mcp.json` with plugin-root `cwd` for Codex and `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}` for Claude; validate that only path resolution differs, and canonicalize the executable script path before deciding whether to run the stdio main loop.
- 2026-07-23: Replace direct execution of the versioned `runtime/local-household.mjs` cache path with three tools on a dependency-free plugin-provided `fullwell-local` MCP server: read-only load, non-destructive revisioned update, and destructive collecting-only deletion. Stable MCP identities, rather than a broad `node` rule or a self-modifying allowlist, carry one-time host permission across package upgrades.
- 2026-07-22: Make the default new-user authority a single local guest household under the active Codex home. Do not synthesize Fullwell user or household IDs and do not call the hosted MCP service until the user says they already have an account or explicitly chooses cloud backup.
- 2026-07-22: Treat cloud enablement as an explicit promotion, not background sync. Persist locally first, authenticate only after consent, reconcile against the selected hosted household, use the existing idempotent onboarding commit, and retain the local journal unless the user separately deletes it.
- 2026-07-22: Keep WhatsApp, collection sharing, invitations, and multiplayer account-gated. Direct local grocery restocking and recipe recall must work without an account.
- 2026-07-22: Keep `snacks` as the internal onboarding section, profile, completion-report type, and legacy path for backward compatibility, but describe the section to people as grocery-history onboarding for snacks, ingredients, condiments, and other groceries.
- 2026-07-22: Add first-class `ingredient`, `condiment`, and `other_grocery` journal item kinds beside `snack` and `recipe`. Store them under `ingredients/items/`, `condiments/items/`, and `groceries/items/`; write new purchase evidence under `groceries/evidence/` while continuing to read legacy `snacks/evidence/`.
- 2026-07-22: One authorized order-detail traversal must classify every in-scope grocery line into an evidence-backed item. The recurrence threshold controls report inclusion, not whether a low-frequency item such as parsley is learned. Semantic classification remains agent-authored rather than keyword code.
- 2026-07-22: The restocking snapshot includes all four grocery item areas plus legacy and current purchase evidence. Historical formulations remain separate, so a negative qualifier such as "not the Japanese one" filters candidates instead of merging mayonnaise identities.
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

The shared host behavior lives in `packages/agent-client/skills/manage-household-food-journal/SKILL.md`, `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`, and `packages/agent-client/skills/track-recipe-history/SKILL.md`. `packages/agent-client/runtime/onboarding-draft.mjs` owns the authenticated checkpoint boundary, while `packages/agent-client/runtime/local-household.mjs` owns the account-free guest authority and optional cloud-link marker; both are bundled for both hosts. `packages/agent-client/evals/cases/v1.json`, `packages/agent-client/evals/expected/v1.json`, and `packages/agent-client/tests/evals/matrix.test.mjs` make tool order and forbidden behavior deterministic across Codex and Claude.

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

For the local-first iteration, the UX lens requires useful grocery and recipe behavior before sign-in and a single plain-language account question before any hosted call. The privacy lens requires that local state exclude credentials, cookies, browser state, screenshots, raw HTML, and raw page captures. The architecture lens treats guest storage as a separate local authority realm rather than weakening the hosted server's sole-writer rule. The reliability lens requires revision-checked atomic writes, resumability, and non-destructive retry after failed cloud promotion. The eval lens must prove both hosts make zero Fullwell calls on the guest path and begin OAuth only after an affirmative account or backup choice.

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

### Milestone 7 - One-pass whole-grocery learning

Files:

- `packages/contracts/src/domain.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/domain/journal-validation.ts`
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/core/restocking-snapshot.ts`
- `apps/server/src/runner/snapshot-service.test.ts`
- `packages/local-runner/src/snapshot-cache.ts`
- `packages/local-runner/src/host/prompt.ts`
- `apps/server/src/http/web-view-model.ts`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/restock-groceries/SKILL.md`
- `packages/agent-client/references/semantic-food-rules.md`
- `packages/agent-client/references/restocking-and-cart-safety.md`
- `packages/agent-client/evals/`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Extend the strict journal-item and search contracts with `ingredient`, `condiment`, and `other_grocery`, retaining the existing grocery identity fields and semantic distinctions. Map each kind to a canonical item directory and reject a mismatched directory during projection rebuild.
2. Route new purchase evidence to the general grocery evidence area, continue rebuilding legacy snack evidence, and include all grocery item/evidence areas in the credential-free restocking snapshot. Preserve the existing snack profile and report paths as compatibility identifiers.
3. Make the authorized audit traverse each qualifying order detail once and author an evidence-backed item for every in-scope grocery identity during that pass. Apply the recurrence threshold only to report assertions; preserve observed store and exact product provenance for later source selection.
4. Teach restocking to resolve ingredients, condiments, and other groceries from the same closed historical candidate set. Keep formulations such as standard and Japanese-style mayonnaise separate and honor natural exclusions without introducing keyword classification code.
5. Replace snack-only benefit copy with friendly grocery-wide messaging and examples covering snacks, ingredients, condiments, and more. Keep the snack-then-recipe onboarding state order and the one-read/local-draft/one-write approval boundary unchanged.
6. Add contract, projection, service, runner-snapshot, packaging, and cross-host eval coverage for mixed-kind onboarding, below-threshold parsley, negative mayonnaise formulation selection, legacy evidence compatibility, and no second order-history pass.

Feature-critic constraints:

- A non-recurring item is still learned; only its omission from a recurrence report is allowed.
- The item kind and repository directory must agree, but legacy `snacks/evidence/` remains readable so existing households reconcile without migration.
- The runner snapshot must contain every new grocery item area and `groceries/evidence/`, or WhatsApp requests would appear supported while lacking product/source evidence.
- `snacks` remains the internal onboarding section/report compatibility key. Do not add a third onboarding section or force existing users to repeat setup.
- Agent instructions assign grocery kinds and interpret exclusions. Server and client programs validate enumerated structure only and never classify food names.
- Deploy the additive server contract before publishing the client that can emit new kinds. After a new-kind write, rollback must use a schema-compatible image rather than an older image that rejects the repository format.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- domain/journal-validation.test.ts domain/repository-projection.test.ts services/household-food-journal.test.ts runner/snapshot-service.test.ts`
- `npm run test --workspace @fullwell/local-runner -- src/snapshot-cache.test.ts src/host/adapters.test.ts src/runner.test.ts`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 8 - Local-first guest onboarding and optional cloud promotion

Files:

- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/skills/restock-groceries/SKILL.md`
- `packages/agent-client/skills/share-food-collection/SKILL.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `apps/web/src/routes/install.tsx`
- `docs/product-specs/household-food-journal-client.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Add a dependency-free local guest-household runtime under the active Codex home with a generated local identity, bounded JSON journal, monotonic revision, atomic `0600` writes inside `0700` directories, a lock, explicit collecting/ready state, and optional cloud-backup metadata. Reject credentials, cookies, tokens, browser state, screenshots, raw HTML, raw pages, unsafe paths, oversized documents, stale writes, and malformed state.
2. Route a fresh greeting through one account question before any hosted call. An affirmative existing-account answer starts the existing OAuth/context/household path. A negative answer initializes or resumes the local guest household and starts grocery-history questions immediately. A remembered guest household resumes without asking the account question again.
3. Reuse the same grocery and recipe semantic workflow in local mode, checkpoint after meaningful progress, finalize locally before offering cloud backup, and make later direct restocking and recipe recall read the finalized local journal without MCP. Natural section declines still advance; whole-flow cancellation removes only an unfinalized guest journal after explicit confirmation.
4. After local finalization, offer optional Fullwell account creation in benefit terms: cloud backup, WhatsApp, sharing, and family access. Only an affirmative answer may call `hfj_get_context`. Create or select a hosted household, reconcile local identities against the hosted snapshot, show the exact cloud copy/merge summary, call `hfj_commit_onboarding` once after confirmation, and record the returned user, household, HEAD, and local revision. Never delete or mark backed up after a failed or uncertain call.
5. Keep remote MCP configuration available but on-use. Account-gated requests from a guest, including WhatsApp and collection sharing, offer promotion instead of failing generically. Update install copy, shared specifications, architecture, changelogs, package version, Codex and Claude manifests/catalogs, and the implementation log.
6. Add deterministic runtime coverage and cross-host evals for first install/no account, existing account, guest resume, zero pre-consent Fullwell calls, local direct utility, declined backup, successful promotion, failed promotion retention, non-empty-hosted-household reconciliation, and prohibited local data.
7. After successful local finalization or hosted onboarding commit, invite a concrete out-of-stock restocking request when grocery evidence exists. Explain history-based product/store selection and retain explicit cart confirmation; never show the invitation after failed, cancelled, unfinished, or no-grocery completion.

Feature-critic constraints:

- Missing local state is the only condition that asks the account question automatically. A remembered guest journal resumes locally; an explicit later request to connect or back up may start OAuth.
- The remote MCP service must not be called to discover whether an account exists. The user's answer is the routing decision.
- A local file is not a cloud backup and must not be described as one. Failed or declined promotion leaves the local journal authoritative and useful.
- Promotion into an existing hosted household requires semantic duplicate review and current hosted revisions; never overwrite or silently merge based on deterministic title matching.
- Local state stores bounded journal evidence and agent-authored conclusions only. It never stores retailer credentials, cookies, browser session state, screenshots, raw HTML, raw page captures, OAuth tokens, or one-time codes.
- Cloud linkage is recorded only from a successful hosted response. Exact retry reuses the same promotion payload and idempotency key; changed retry requires a new summary and confirmation.
- Package rollback leaves local guest data in place and readable by the released helper version. No server schema or deployment change is required because promotion reuses the existing hosted onboarding contract.

Verification:

- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run build --workspace @fullwell/fullwell`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 9 - Stable local runtime permission boundary

Files:

- `packages/agent-client/.mcp.json`
- `packages/agent-client/codex-mcp.json`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `docs/product-specs/household-food-journal-client.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Add a dependency-free stdio MCP server named `fullwell-local` beside the existing hosted server. Expose stable read-only load, non-destructive revisioned update, and destructive collecting-only deletion tools that delegate to the existing bounded local-household runtime and never use the network.
2. Route every guest load and mutation through those stable tool identities. Do not execute the immutable cache path directly, edit user rules, add a broad `node` allow rule, or install executable code outside the plugin cache.
3. Keep approval semantics truthful: load is read-only, initialize/save/finalize/cloud-link updates are non-destructive writes, and cancellation deletion remains destructive. Explain that a host may ask once before allowing local journal updates and that a persistent approval applies only to the named local tool.
4. Preserve the existing journal path, schema, revision checks, atomic private writes, limits, forbidden-data validation, and account-free behavior. A local-server startup or protocol error must fail closed with a reload/reinstall instruction and must not fall back silently to the versioned shell command or hosted MCP service.
5. Bump the immutable agent package and both host catalogs together. Add protocol, malformed-request, size, error-redaction, tool-annotation, packaging, lifecycle, and cross-host eval coverage.

Feature-critic constraints:

- The local server and tools keep stable names across patch and minor package versions; changing their security contract requires a new identity and fresh approval.
- The local server accepts only newline-delimited JSON-RPC over stdio, bounds every inbound line before parsing, emits no journal data to stderr or logs, and returns domain failures as explicit tool errors.
- Read and write operations cannot share a destructive annotation. Deletion must remain a separate tool so ordinary onboarding permission cannot authorize removal.
- The server delegates semantic storage validation to `local-household.mjs`; it must not duplicate or weaken the forbidden-data, revision, path, or size boundary.
- The remote `household-food-journal` server remains on-use and is never contacted by local tool startup or guest operations.
- Codex and Claude must both install and discover the same local MCP declaration from an isolated package copy.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run build --workspace @fullwell/fullwell`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 10 - Cross-host plugin-root correction

Files:

- `packages/agent-client/.mcp.json`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `docs/product-specs/household-food-journal-client.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Keep Codex on a plugin-root working-directory adapter and give Claude `${CLAUDE_PLUGIN_ROOT}/runtime/local-household-mcp.mjs`; validate that both adapters retain the same server identity, remote endpoint, inherited environment, timeout, and packaged runtime.
2. Preserve the existing `fullwell-local` server and three tool identities so retained narrow approvals remain compatible. Do not add shell evaluation, an absolute user path, another launcher, or broader inherited environment.
3. Strengthen isolated lifecycle evidence: Codex must expose the installed-cache working directory, Claude must report the plugin-provided local server as connected rather than merely list its name, and the server main-module guard must survive macOS real-path canonicalization.
4. Publish the immutable `1.1.10` correction, verify registry checksums and clean downloaded lifecycles, update both current host installations, and record that no application-server deployment is required.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run build --workspace @fullwell/fullwell`
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

- A fresh installation's `@Fullwell hi` path asks whether the person already has an account before any Fullwell call. A negative answer initializes local state and begins grocery then recipe questions without OAuth or MCP; an affirmative answer uses the existing authenticated path.
- A remembered guest journal resumes locally without asking the account question again, and direct local restocking and recipe recall remain available after the person declines cloud backup.
- Cloud backup is offered only after local finalization. An accepted promotion authenticates, reconciles against one current hosted household, shows the exact copy/merge summary, and records a cloud link only after one confirmed successful commit; failure or uncertainty leaves the local journal authoritative.
- WhatsApp, collection sharing, invitations, and family access remain account-gated and explain the promotion path instead of treating local use as invalid.
- Successful local and hosted grocery onboarding asks the user to try one concrete out-of-stock restocking request, while unsuccessful or no-grocery completion does not imply the capability is ready.
- A fresh editable hosted household's path uses one `hfj_get_context` read, asks snack then recipe questions, and makes no Fullwell mutation before final confirmation.
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

Public `@fullwell/fullwell@1.1.10` corrects the live Claude startup failure without changing the stable `fullwell-local` server or tool identities. Codex retains its plugin-root working-directory adapter; Claude resolves the same server through `${CLAUDE_PLUGIN_ROOT}`; and the stdio main-module guard compares canonical filesystem paths so macOS `/tmp` and `/var` aliases do not cause a silent exit. Correction commit `ac4e231` is on `origin/main`; npm `latest` resolves to the checksum-matched 21-entry artifact; a clean registry install passes both host lifecycles; and current Codex and Claude are enabled on `1.1.10`, with Claude reporting the installed local server as `Connected`. No application-server deployment was necessary.

Public `@fullwell/fullwell@1.1.9` replaces direct execution of a versioned plugin-cache script with the plugin-provided `fullwell-local` MCP server. Its stable read-only load, non-destructive update, and collecting-only destructive deletion identities let a host retain narrowly scoped permission across compatible package upgrades while keeping cancellation separate. The server is dependency-free, offline, bounded, redacts unexpected failures, delegates journal validation to the existing runtime, and is discovered from isolated Codex and Claude installs. Implementation commit `cbc16c9` is on `origin/main`; npm `latest` resolves to the checksum-matched 20-entry artifact, and the downloaded package passes both isolated host lifecycles. No server deployment was necessary because the application runtime did not change.

The local implementation now provides one account-free guest household under the active Codex home, asks about an existing account before any hosted call, resumes remembered guest state without re-asking, and supports grocery/recipe onboarding plus direct local use without OAuth. After local finalization it offers optional cloud backup for WhatsApp, sharing, and family access. Promotion is explicit, semantically reconciled, idempotent, and non-destructive: failure retains the local authority, success records the exact promoted revision, and later local edits make the marker stale instead of implying a backup that did not occur. Public package `@fullwell/fullwell@1.1.8` contains the same runtime and shared Codex/Claude instructions.

The authenticated implementation retains one lock-consistent `hfj_get_context` read, no intermediate Fullwell mutation, a user/household/snapshot-bound local checkpoint, one explicit final summary/confirmation, and one `hfj_commit_onboarding` write. Public `@fullwell/fullwell@1.1.7` carries the existing checkpoint and 10,000-item/10,000-evidence guidance for Codex and Claude, plus one-pass classification and restocking knowledge for snacks, ingredients, condiments, and other groceries. Skip-only confirmation leaves Git unchanged; canonical changes create one commit; exact replay does not create another commit; changed replay conflicts; post-Git skip failure is recovered from bounded metadata.

Local evidence for the published `1.1.5` baseline passes 279 deterministic tests with 11 database-gated skips, the 11 PostgreSQL integration tests separately through Apple Container, 29 browser tests with seven intentional project skips, 35 cross-host eval cases, eight package/lifecycle tests, migrations up/down/up, security/load/contract gates, the full repository verification, and 96.47% statement/line, 94.85% function, and 90.03% branch coverage. The prepared `1.1.6` correction independently bounds one onboarding request at 10,000 evidence records, 10,000 unique items, two reports, two profiles, two section outcomes, and a route-specific 16 MiB MCP body limit while retaining the one-megabyte default elsewhere. A 200-item snapshot truncation, stale state, ambiguity, or oversized draft may require additional approved reads; a draft within the final count and byte bounds must not be split into intermediate writes.

The `1.1.6` correction passes 284 deterministic tests with 11 expected database-gated skips, the focused contract/server/security/load suites, 29 browser tests with seven intentional project skips, 36 cross-host eval cases, and eight package/lifecycle tests. Its compact maximum-count service fixture commits and replays exactly once in about 0.6 seconds, and an isolated real Git repository stages and commits 20,000 paths without process argument expansion. Commits `b6b12db` and `785ec06` are pushed, and the production dependency audit reports zero vulnerabilities.

Staging now runs `hfj-staging:onboarding-capacity-20260722-2-runtime` with Linux/amd64 OCI index digest `sha256:87cc996a1c1d2666ccf1700cb9052655e24d937e1f1a6b8b3d9f9fafe21cad65` from checksum-matched archive SHA-256 `f433edbee1f69dde9e88017be9cfaae56bd94aaaf68e1654e5eeeb3cb2dcd898`. Public live/readiness, deployment, and OAuth/MCP discovery smokes pass at schema `0007`; a 1,100,070-byte live MCP request reaches authentication rather than the former one-megabyte parser rejection; and `hfj-staging:onboarding-drafts-20260722-1-runtime` plus the pre-release environment backup remain available for rollback.

Public immutable package `@fullwell/fullwell@1.1.6` has registry SHA-1 `1bb746d86d651176aa8cdab13ceff11e3655043d` and SHA-512 `sha512-P0tKysnAyMgycArCGRkk//4HNN83w7J7a5DPqtiaMFhwxLs8ixLtjksifZeqD+ZfInlANTInJlZB+7M0EZCtjA==`, matching the prepared 18-file artifact. `latest` resolves to `1.1.6`, a clean registry install passes isolated Codex and Claude lifecycles, and current Codex and Claude both report enabled `fullwell@fullwell` version `1.1.6`.

Whole-grocery release commit `681952e` is pushed. Staging runs `hfj-staging:whole-grocery-20260722-1-runtime` with Linux/amd64 OCI index digest `sha256:a18a9bdffeb4869d0e4c499755a1cfa4fe619c0137cf2e5df3895ae73fd5a641` from archive SHA-256 `44524cd4ef00b7d271c2110c598e341f3f8498cea9cdc783d03ab99d91616441`, while the prior capacity image remains available for rollback. Public `@fullwell/fullwell@1.1.7` has registry SHA-1 `8dadf6a576cc47adc8841bc3cb7aaa3f72ddac7b` and SHA-512 `sha512-pacGSP9DQCLJSm4EYIRNxw3zzIFh6VbdTfnDbWpBk1+m3vhdrhaeK2VoXsHkuaYJjdt+cCfvpsWjD60JRfgt8g==`; clean registry lifecycles pass and both current hosts report enabled version `1.1.7`.

Fresh `gpt-5.6-sol` sessions from the separate `fullwell-tester` folder prove the deployed response contains a stable user ID, a bounded checkpoint can be saved with zero Fullwell mutations, another conversation resumes the same marker and deletes the matching revision, and a final exact-shard load reports it missing. The transcript retains only booleans and mutation counts. A real final-confirmation write was intentionally not driven automatically because it would change the user's household based on invented onboarding answers; deterministic and PostgreSQL tests cover that atomic write. The required screencast was attempted and failed because the macOS FFmpeg build does not provide `x11grab`; no MP4 is claimed.

Local-first `1.1.8` acceptance passes seven guest-runtime tests, 44 cross-host eval cases, all 15 package/lifecycle tests, the package build, 289 deterministic application tests with 11 expected database skips, and 29 WebKit checks with seven intentional skips. Implementation commit `cade45e` is on `origin/main`. The public 19-entry registry artifact was published at `2026-07-23T01:54:54.598Z`; SHA-1 `f88bc7c0623a51956e9c5db2cea186a2d4dfeb0c` and SHA-512 `sha512-nPMvo7cw687woeAdO8V3hb31V7qUnzipa1quW4GdW6um9Vqu4gKfyrv80dWo2PR4ry8wWJgXuUAA02jvWv29Rg==` match the prepared artifact, and a clean downloaded install passes isolated Codex and Claude lifecycles. The completion handoff now invites an evidence-backed restocking request only after successful local finalization or hosted commit, explains the usual product/store lookup, and retains cart confirmation. The dedicated screencast attempt also failed on the helper's Linux-only `x11grab` input with code 234; browser e2e evidence is retained, but no MP4, host upgrade, or server deployment is claimed for `1.1.8`.
