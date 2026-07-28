# Atomic Cloud Journal Save After Local-State Loss

## Purpose / Big Picture

An installed Fullwell client may lose `~/.codex/fullwell` while the member's
authenticated cloud household remains intact. Reconnecting already finds that
household, but an ordinary direct recipe save currently uses two cloud
mutations: `hfj_append_evidence`, then `hfj_commit_change_set`. In production,
the Neon projection object for the first mutation can be loaded outside the
household transaction, so the Git commit succeeds while the projection update
is not flushed. The second mutation then rejects the newly cited evidence as
missing and leaves an orphan evidence commit.

The completed behavior is one atomic ordinary journal mutation containing new
evidence plus its items and reports. The mutation validates under the household
lock, creates one signed Git commit, persists the transaction-scoped Neon
projection and search index before returning success, and is immediately
readable. Losing local guest state does not copy cloud data locally or create a
second authority; successful OAuth membership remains sufficient to resume the
cloud household.

## Progress

- [x] 2026-07-28T20:28Z: Reproduced the failure from the supplied transcript and traced
  the production-only projection persistence gap.
- [x] 2026-07-28T20:28Z: Created and claimed Beads issue `fullwell-3wm`.
- [x] 2026-07-28T20:28Z: Extended and implemented the atomic ordinary journal
  contract.
- [x] 2026-07-28T20:28Z: Updated agent guidance, evals, product truth, and
  changelogs.
- [x] 2026-07-28T20:28Z: Ran focused, Neon-backed, end-to-end, and repository
  verification.
- [x] 2026-07-28T20:28Z: Closed Beads issue `fullwell-3wm` after every
  acceptance criterion passed.

## Surprises & Discoveries

- 2026-07-28: The missing local household was not the direct failure. OAuth and
  `hfj_get_context` correctly recovered the existing cloud membership without
  local canonical state.
- 2026-07-28: `hfj_append_evidence` and `hfj_commit_change_set` load a projection
  before `MutationRunner` enters `withHouseholdLock`. `NeonOperationalStore`
  flushes only projection objects loaded into the transaction-local cache, so
  mutating the earlier object can advance Git and household/member HEADs without
  updating `journal_projections`.
- 2026-07-28: In-memory service tests preserve object identity and therefore
  cannot expose this Neon transaction-boundary defect.
- 2026-07-28: The server already has the desired atomic pattern in
  `hfj_commit_onboarding` and `hfj_commit_delivery_index`; ordinary journal
  updates are the outlier.

## Decision Log

- 2026-07-28: Extend `hfj_commit_change_set` with bounded non-delivery evidence
  instead of adding a recipe-specific tool. Recipes and groceries share the same
  evidence-backed journal invariant, and the existing change-set name already
  describes the atomic unit.
- 2026-07-28: Keep `hfj_append_evidence` for evidence-only checkpoints and
  bounded standalone batches. Removing it would expand this recovery fix into a
  migration of long-running audit workflows.
- 2026-07-28: Perform evidence, item-revision, and report validation inside
  `MutationRunner`'s household lock, then load the projection again inside
  `applyProjection`. This aligns validation and persistence with the locked Git
  HEAD and transaction-scoped Neon cache.
- 2026-07-28: Do not hydrate a replacement local household from cloud
  automatically. Cloud Git remains authoritative after authenticated account
  recovery; silent local copying would create a second unsynchronized authority
  and blur privacy expectations.
- 2026-07-28: Return the authenticated `actor_id` beside the cloud user ID in
  `hfj_get_context`, and require ordinary submitted evidence to use that actor.
  The trace showed the agent first trying the `usr_...` ID and then making a
  member-list call to discover its own `act_...` ID. Attribution is a trusted
  boundary, not a schema-guessing exercise.
- 2026-07-28: Enable request-fingerprint enforcement for
  `hfj_commit_change_set`. Exact retries return the original result; changed
  payload reuse of the same key must conflict even after completion.

## Context and Orientation

`packages/contracts/src/tools.ts` defines MCP input schemas.
`apps/server/src/services/household-food-journal.ts` implements both ordinary
journal mutations. `apps/server/src/services/mutation-runner.ts` owns durable
mutation states and the household-scoped lock.
`apps/server/src/persistence/neon-operational-store.ts` stores a serialized
`journal_projections` document and flushes transaction-cached projections when
the mutation transitions to `projections_applied`.

`packages/agent-client/skills/track-recipe-history/SKILL.md` currently tells a
standalone cloud update to append evidence and then commit the item.
`packages/agent-client/skills/manage-household-food-journal/SKILL.md` repeats
that two-tool ordinary-cloud guidance. The matching MCP reference, eval matrix,
client/server product specs, and changelogs must remain synchronized.

The durable mutation states remain:
`received -> locked -> git_committed -> projections_applied -> completed`.
Input or optimistic-concurrency failures must happen before `git_committed`.
After a commit, any projection failure must remain
`reconciliation_required`, and an exact idempotent retry must never create a
second commit.

### Framing Notes

Expert panel:

- Staff engineer — keep the mutation boundary aligned with the domain unit.
- Reliability engineer — require durable projection visibility before success.
- Agent UX/evals expert — make the recovered-account path use one unambiguous
  write and stop schema-guessing retries.
- Privacy/security reviewer — preserve explicit local/cloud authority
  separation and avoid silent hydration.

The synthesis is to solve both halves of the failure: an atomic public contract
prevents partial recipe saves, while transaction-scoped projection handling
ensures the successful commit is immediately visible. Tests must include Neon,
because memory adapters cannot prove the persistence contract.

## Milestones

### Milestone 1 — Atomic Contract And Transactional Projection

Files:

- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/persistence/neon-operational-store.integration.test.ts`

Tasks:

1. Add a bounded `evidence` collection to `hfj_commit_change_set` and return the
   authenticated actor ID from `hfj_get_context`.
2. Under the household lock, build a prospective evidence map, reject duplicate
   or invalid correction references, require authenticated actor attribution,
   validate submitted items/reports against it, and verify expected item
   revisions.
3. Commit submitted evidence, items, and reports in one repository mutation.
4. In `applyProjection`, load the transaction-scoped projection and update both
   evidence and items before the `projections_applied` transition flushes it.
5. Make the existing evidence-only mutation load, validate, and mutate its
   projection inside the transaction as well.
6. Enforce request fingerprints on completed change-set replays.
7. Cover atomic success, invalid attribution/evidence pre-commit failure, stale
   conflict, exact replay, changed-key conflict, and immediate search
   visibility.
8. Add Neon-backed service regression coverage proving a second transaction
   observes the evidence/item projection after the first returns.

Verification:

- `npm run build --workspace=@hfj/contracts`
- `npm run test:unit --workspace=@hfj/server -- household-food-journal`
- `npm run container:postgres:verify`

### Milestone 2 — Agent And Product Contract

Files:

- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `packages/agent-client/CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`

Tasks:

1. Route ordinary standalone cloud journal updates through one atomic
   `hfj_commit_change_set` containing evidence and authored changes.
2. Preserve `hfj_append_evidence` only for evidence-only/checkpoint use cases.
3. Add an eval for missing local state plus an existing cloud household and a
   direct recipe-save request; require one atomic change-set and forbid
   speculative schema retries, member-list lookup for the current actor, or
   local hydration.
4. Document the public contract, projection durability, recovery semantics, and
   authority boundary.
5. Record the user-visible fix in the client changelog and implementation log.

Verification:

- `npm run test:evals`
- `npm run test:unit --workspace=@fullwell/fullwell`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 3 — Integrated Acceptance And Recovery

Files:

- `docs/exec-plans/active/2026-07-28-atomic-cloud-journal-save.md`

Tasks:

1. Run the complete repository gates in the required order.
2. Review the final diff for contract and documentation drift.
3. If installed-host capture is available, record a sanitized conversation that
   starts with missing local household state, reconnects to an existing cloud
   household, saves one recipe, and immediately searches it:
   `npm run capture:screencast -- --output artifacts/screencasts/atomic-cloud-recipe-save.mp4`.
4. Move this plan to `docs/exec-plans/completed/` and close `fullwell-3wm` only
   when all acceptance criteria pass.

Verification:

- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `git status --short`

## Acceptance / Verification

- With `fullwell_local_household_load` returning `missing`, an authenticated
  existing member can select the cloud household and save a recipe without
  initializing or hydrating a local guest household.
- `hfj_get_context` returns the authenticated `actor_id`, and the server rejects
  ordinary evidence attributed to another actor.
- The client makes one `hfj_commit_change_set` call containing the new recipe
  evidence and item; it does not first call `hfj_append_evidence`.
- Invalid evidence, unsupported recipe status, stale HEAD, or stale item
  revision fails before a Git commit and leaves no orphan evidence.
- A successful response means Git, `journal_projections`, `search_items`,
  household HEAD, and active membership projection HEAD agree.
- The saved recipe is immediately returned by `hfj_search_items`.
- Replaying the same idempotency key and payload returns the original commit;
  changed reuse conflicts.
- Existing evidence-only checkpoint workflows remain supported.
- Run:
  `npm run build --workspace=@hfj/contracts`,
  `npm run test:unit --workspace=@hfj/server -- household-food-journal`,
  `npm run container:postgres:verify`,
  `npm run test:evals`,
  `npm run test:e2e`,
  `npm run verify`,
  `npm run verify:docs`, and
  `npm run verify:execplan`.
- Rollback the agent guidance and contract together if the new input cannot be
  accepted safely. Do not roll back a server after it has accepted atomic
  evidence/item commits to a reader that cannot parse the unchanged repository
  files. Existing orphan evidence is valid append-only history and should be
  repaired by a later evidence-citing item commit, never deleted or rewritten.

## Outcomes & Retrospective

The server and shared client contract now treat bounded ordinary journal work as
one evidence-plus-conclusion mutation. The change set validates actor
attribution, corrections, citations, item revisions, and idempotent replay under
the household lock, writes one Git commit, and flushes the transaction-scoped
Neon projection before returning success. `hfj_get_context` exposes the current
actor ID, and client guidance resumes an authenticated cloud household without
creating or hydrating local authority.

Passing evidence:

- contract build, server typecheck, 17 focused service tests, 39 contract tests,
  14 agent eval tests, and 53 package/lifecycle tests;
- eight-migration up/down/up verification plus all 12 Neon integration tests,
  including the recovered-cloud recipe regression;
- `npm run test:e2e`: 142 passed and 22 intentional project skips;
- `npm run verify`: lint, typecheck, production builds, 423 application tests
  with 12 expected database-gated skips, ideas, docs, and ExecPlan checks.

No screencast is claimed. This change has no new browser UI, and the documented
macOS capture helper remains unavailable because its FFmpeg path requires
Linux-only `x11grab`; deterministic agent eval and browser evidence cover the
workflow instead.

Production still needs the server/client rollout. The original accepted
evidence commit remains valid append-only history but its missing recipe item
must be repaired after deployment by rebuilding the projection and committing
the item against the original evidence ID. It must not be deleted or rewritten.
