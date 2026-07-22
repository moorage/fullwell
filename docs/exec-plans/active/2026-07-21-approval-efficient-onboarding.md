# Approval-Efficient Fullwell Onboarding

## Purpose / Big Picture

Fullwell onboarding currently turns one conversational snack-then-recipe flow into a sequence of separately approved MCP reads and writes. The user should instead approve at most one initial Fullwell read and one final Fullwell write in the normal fresh-household path. `hfj_get_context` will return a bounded, membership-authorized onboarding snapshot containing the current section states, snack and recipe profiles, repository HEAD, and a bounded existing-item index. Codex or Claude will keep answers and collected evidence only in the active conversation until it can show a final summary. One new `hfj_commit_onboarding` tool will then validate and persist the complete evidence, item, report, profile, and skip result as one idempotent household mutation and one signed Git commit.

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
- [ ] Milestone 4 - synchronize documentation, verify, publish, deploy, and live-test.

## Surprises & Discoveries

- 2026-07-21: Codex tool approval is host-owned. A plugin cannot grant itself a temporary onboarding approval lease, so Fullwell must reduce its own call count and truthfully annotate tool effects rather than trying to suppress host safety policy.
- 2026-07-21: The current audit path intentionally commits evidence before conclusions, which creates at least two Git writes per section. A one-write onboarding path must validate newly submitted evidence and conclusions together without weakening the evidence-first semantic rule.
- 2026-07-21: Per-user skip state is Neon operational data, while completed state is derived from canonical Git reports. A mixed complete/skip finalization therefore crosses the existing Git and Neon recovery boundary and must retain bounded recovery intent in the mutation record.
- 2026-07-21: A complete existing-item corpus is not safe to embed in `hfj_get_context`. The snapshot must expose only bounded identity summaries and signal truncation; ambiguous existing-item conflicts may require an additional read rather than silently merging.
- 2026-07-22: The initial implementation exposed the generic mutation runner's historical completed-replay behavior, which did not compare a changed payload after success. The new final onboarding tool now retains and checks its request fingerprint on completed replay without changing legacy tool behavior.
- 2026-07-22: Adding the combined boundary initially reduced repository branch coverage from 90.07% to 89.58%. Contract and service edge tests for empty/duplicate input, no-household snapshots, invalid completion/skip, stale HEAD, changed replay, and unchanged skips restored the enforced gate to 90.03%.

## Decision Log

- 2026-07-21: Keep the draft in active host conversation state, not a workspace file, plugin cache, browser profile, or new client-side database. This avoids a second synchronization engine and accidental Git inclusion; interruption before final confirmation leaves canonical state unchanged.
- 2026-07-21: Extend `hfj_get_context` instead of adding another initial-read tool. One selected-household response can safely carry profiles and a bounded item index after the existing membership check.
- 2026-07-21: Add one purpose-specific `hfj_commit_onboarding` tool rather than broadening `hfj_commit_change_set`. The new contract can require section outcomes, bound the combined payload, and coordinate per-user operational skip state without changing ordinary journal updates.
- 2026-07-21: A `complete` section outcome is accepted only when the same request writes the matching canonical report or the report already exists. The agent still cannot persist an independent completion flag.
- 2026-07-21: Preserve `hfj_update_onboarding` for backward compatibility and resumable older clients, but the new shared skills do not call it during an ordinary read-draft-commit run.
- 2026-07-21: Treat one Fullwell read and one Fullwell write as the target, not an absolute promise across every household. Truncated item indexes, stale HEADs, payload limits, authorization changes, or explicit conflict resolution fail closed and may require another user-approved read or retry.
- 2026-07-21: Represent only changed section outcomes in a unique bounded array. Already-complete sections and an unchanged prior skip are omitted; completing a previously skipped section needs the canonical report but no synthetic `resume` write.
- 2026-07-21: A final skip-only request with no canonical file changes completes as one Neon operational mutation against the current HEAD. It never creates an empty Git commit or stores per-user skip state in the shared household repository.

## Context and Orientation

`packages/contracts/src/tools.ts` owns the stable MCP tool union and strict input schemas. `packages/contracts/src/onboarding.ts` owns section states and bounded skip reasons. `apps/server/src/http/app.ts` publishes tool metadata. It currently publishes names, descriptions, and input schemas without MCP tool annotations.

`apps/server/src/services/household-food-journal.ts` implements `hfj_get_context`, profile/item reads, evidence append, change-set commits, and per-user onboarding transitions. `apps/server/src/services/mutation-runner.ts` owns the signed Git commit and durable mutation-state lifecycle. `apps/server/src/core/ports.ts`, `apps/server/src/core/types.ts`, `apps/server/src/adapters/memory.ts`, `apps/server/src/persistence/neon-operational-store.ts`, and `apps/server/src/workers/reconciliation-worker.ts` own operational state, projections, and recovery.

The shared host behavior lives in `packages/agent-client/skills/manage-household-food-journal/SKILL.md`, `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`, and `packages/agent-client/skills/track-recipe-history/SKILL.md`. `packages/agent-client/evals/cases/v1.json`, `packages/agent-client/evals/expected/v1.json`, and `packages/agent-client/tests/evals/matrix.test.mjs` make tool order and forbidden behavior deterministic across Codex and Claude.

Assumptions and constraints:

- The normal acceptance path begins with an existing editable household whose item index is not truncated and whose combined onboarding payload fits the server's current one-megabyte HTTP body limit.
- The initial read does not authorize browsing. Each source and browser remains explicitly user-authorized.
- Draft answers and raw evidence are ephemeral until the final user confirmation. A stopped or abandoned conversation performs no Fullwell write and may need to restart after host context loss.
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
- Security/privacy: never interpret the initial read as permission to inspect browser sources; avoid plaintext local draft files and disclose that an interrupted ephemeral draft is not resumable.
- Architecture: submit new evidence and the conclusions citing it in the same typed request, validate against a combined existing-plus-new evidence map, and commit all canonical changes once.
- Reliability: bind the final request to the snapshot HEAD, item revisions, onboarding revisions, and an idempotency key; persist bounded skip recovery intent before the Git boundary.
- ML/evals: forbid `hfj_update_onboarding`, profile writes, evidence appends, and change-set writes before final confirmation in the normal onboarding eval.

### Key tensions

- Fewer approvals versus persistent cross-session progress.
- One final payload versus the one-megabyte request boundary and large purchase histories.
- Atomic canonical Git content versus per-user operational skip state.
- Bounded context snapshots versus complete semantic duplicate review.

### Synthesis for decomposition

Prove the combined contract and validation first. Then integrate recovery and one-commit persistence. Only after the server boundary passes race/replay tests should the shared skills stop making intermediate mutations. Roll out the server before publishing the client, retain old tools through the compatibility window, and verify the exact current Codex host call sequence against staging.

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
2. Keep source answers, evidence, semantic decisions, profile edits, reports, and bounded skip reasons in active conversation state. Do not write a workspace draft, opt the draft into host memory, or claim cross-session persistence.
3. Before asking for confirmation, ensure the draft is within the advertised evidence/item/report/profile and request-size bounds. Ask the user to review a concise final summary and explicitly confirm the write, then call `hfj_commit_onboarding` exactly once. Do not call `hfj_update_onboarding`, `hfj_update_profile`, `hfj_append_evidence`, or `hfj_commit_change_set` during the normal draft.
4. Preserve snack-before-recipe order, natural section decline, explicit whole-flow stop, browser/source authorization, semantic food rules, and no false completion.
5. Add cross-host evals for two-call success, mixed complete/skip, skip-only finalization, explicit stop with zero writes, stale final commit, truncated inventory, oversized draft, and no intermediate mutation.
6. Prepare the next immutable package version and validate both host lifecycle adapters from the packed artifact.

Verification:

- `npm run test:evals`
- `npm run test:packaging`
- `npm run build --workspace @fullwell/fullwell`

### Milestone 4 - Documentation, rollout, and live evidence

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

1. Document ephemeral drafts, bounded snapshots, one final write, payload/conflict fallbacks, annotations, authority, recovery, and compatibility.
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

The exact schema uses unique section and profile lists so unchanged state is omitted while every persisted outcome remains explicit. `hfj_get_context` returns one consistent HEAD, profile markdown/revisions, section revisions, and bounded item identity summaries needed to construct this request. If a section was already skipped and is declined again, the client omits it unless another canonical/profile change must be committed; a same-request canonical report makes it complete without an operational resume transition.

## Idempotence and Recovery

- The idempotency key binds to a stable fingerprint of the complete final payload. Changed reuse fails with `REVISION_CONFLICT` before any new write.
- The final tool writes all canonical files in one signed Git commit under the expected HEAD. Git path validation and append-only evidence rules remain unchanged.
- A skip-only request with no canonical changes compares the expected HEAD and section revisions, commits the skip rows plus completed idempotency response in one Neon household transaction, and records the unchanged HEAD as its replay anchor.
- The mutation record retains only the request fingerprint and bounded skip recovery intent, never raw source evidence or profile/report prose beyond what is canonical in Git.
- If Git succeeds but projections or skip compare-and-set fail, the request enters `reconciliation_required`. Exact retry or the reconciliation worker rebuilds Git projections and reapplies the bounded skip intent before completion.
- If the host loses the response after completion, exact retry returns the recorded response without another commit or onboarding transition.
- The prior server and client remain compatible because existing tools are retained. Rollback disables the new client first, restores the previous server image second, and leaves any successfully committed canonical content valid.

## Acceptance / Verification

- A fresh editable household's `@Fullwell hi` path uses one `hfj_get_context` read, asks snack then recipe questions, and makes no Fullwell mutation before final confirmation.
- The client verifies payload bounds, shows a bounded summary of intended profile, evidence, report, and skip changes, and obtains explicit confirmation before the write.
- One `hfj_commit_onboarding` call persists the ordinary completed run and returns final derived section status without a follow-up read.
- A natural snack or recipe decline stays local during the conversation and is persisted as a bounded per-user skip only in the final call; an explicit whole-flow stop performs no write.
- Browser/source authorization remains explicit and separate from Fullwell tool approval.
- New evidence may support same-request item and report conclusions, but missing, duplicate, or arithmetically inconsistent evidence fails validation.
- Stale HEAD/item/onboarding revisions, changed idempotency payloads, viewers, cross-household substitution, truncated duplicate context, oversized payloads, and crash-after-commit recovery fail closed without duplicate Git commits or false completion.
- Current and previous clients remain compatible during rollout; tool annotations truthfully distinguish reads, ordinary writes, and destructive actions.
- Contract, server, reconciliation, load, security, eval, packaging, browser, integration, full verification, deployment smoke, and live current-host evidence pass.
- Screencast command: `npm run capture:screencast -- --output artifacts/screencasts/approval-efficient-onboarding.mp4`.

## Outcomes & Retrospective

Local implementation is complete. The normal existing-household path now has one lock-consistent `hfj_get_context` read, no intermediate Fullwell mutation, an active-conversation-only draft, one explicit final summary/confirmation, and one `hfj_commit_onboarding` write. Package `1.1.3` carries the same behavior for Codex and Claude. Skip-only confirmation leaves Git unchanged; canonical changes create one commit; exact replay does not create another commit; changed replay conflicts; post-Git skip failure is recovered from bounded metadata.

Local evidence passes 279 deterministic tests with 11 database-gated skips, the 11 PostgreSQL integration tests separately through Apple Container, 29 browser tests with seven intentional project skips, 32 cross-host eval cases, isolated Codex and Claude lifecycle tests, migrations up/down/up, security/load/contract gates, the full repository verification, and 96.47% statement/line, 94.85% function, and 90.03% branch coverage. The combined request remains bounded by 500 evidence records, 100 items, two reports, two profiles, two section outcomes, and the one-megabyte HTTP body limit. A 200-item snapshot truncation, stale state, ambiguity, or oversized draft may require additional approved reads or bounded writes.

Staging now runs `hfj-staging:onboarding-20260721-1-runtime` with Linux/amd64 OCI index digest `sha256:b791554abbcc4ead0956226decc7f8cf34647f07b3d84fe066934f08828c7675` from checksum-matched archive SHA-256 `48e9b43133dfc5040628ab8d110501ab969658eb543fca16c4013b3252a4e1f5`. Public live/readiness, deployment, and OAuth/MCP discovery smokes pass at schema `0007`; `hfj-staging:mcp-meta-20260721-1-runtime` and a root-only pre-release environment backup remain available for rollback.

Public immutable package `@fullwell/fullwell@1.1.3` was published at `2026-07-22T05:54:49.747Z`. Registry SHA-1 `1128385f465815864a632e69be9cc665e4cc0a8b` and SHA-512 `sha512-5mA8D3osfyWMn6768LW3gb/aiGZ03HKbiuZ++udIGF3hJCn5VsGgTkFftbQjmgMt9s+XQXhk1qn/eLlbcsjrhQ==` match the prepared artifact; `latest` resolves to `1.1.3`, the downloaded package passes both isolated host lifecycles, and current Codex and Claude both report enabled `fullwell@fullwell` version `1.1.3`.

The separate-folder current Codex smoke proves one successful `hfj_get_context`, zero Fullwell writes, snack-first prompting, and no generic "what's on your mind" reply. A real final-confirmation write was intentionally not driven automatically because it would change the user's household based on invented onboarding answers. That final live user-directed write transcript remains before Milestone 4 can close. The required screencast was attempted and failed because the macOS FFmpeg build does not provide `x11grab`; no MP4 is claimed.
