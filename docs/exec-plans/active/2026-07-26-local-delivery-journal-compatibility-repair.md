# Local Delivery Journal Compatibility Repair

## Purpose / Big Picture

Fullwell 1.1.15 can reject a private local delivery journal created by an older workflow when a delivery-dish identifier is shorter than the current canonical identifier contract. The data remains present, but the user is stranded behind implementation language such as “validation,” “connector,” and “migration operation,” and the agent has no supported way to recover.

This change adds one bounded local compatibility repair to the existing non-destructive household-update tool. The agent runs it automatically after a compatible local-journal load failure, reloads the repaired journal, and resumes the interrupted sync or other task. The repair changes identifiers and their exact internal references only; it does not reinterpret food, merge dishes or restaurant locations, delete history, contact Fullwell cloud, or authorize a hosted write. If a future problem cannot be repaired without guessing, Fullwell preserves the file and asks at most one practical question in ordinary language that assumes the user knows nothing about Fullwell internals.

## Progress

- [x] 2026-07-26T17:25Z: Reproduced the installed failure against revision 460 without printing food names, provider order locators, source URLs, or other private history. Five legacy delivery-dish IDs fail the current minimum length and are cited by three delivery-report rows.
- [x] 2026-07-26T17:25Z: Framed and decomposed the compatibility, data-integrity, agent-recovery, UX, eval, and release work.
- [x] 2026-07-26T18:18Z: Milestone 1 - added the deterministic, atomic, idempotent local compatibility repair and MCP contract; 35 focused runtime/MCP tests pass.
- [x] 2026-07-26T18:18Z: Milestone 2 - made the Fullwell agent repair, reload, and resume automatically with novice-friendly fallback language; the 14-case eval matrix and package build pass.
- [x] 2026-07-26T18:18Z: Proved the complete transform on a private copy of revision 460 without emitting private content: revision 461 validates with all 511 delivery order lines preserved, 138 normalized dishes, and 24 exact restaurant/location report rows.
- [ ] Milestone 3 - verify, release, reinstall, and exercise the repair through the installed package.

## Surprises & Discoveries

- 2026-07-26: The affected journal is structurally intact. Its five incompatible IDs use the bounded lowercase legacy shape `itm_<letters-and-digits>` and are referenced only from canonical delivery-report rows; the shortest ID predates the current 16-character payload minimum.
- 2026-07-26: `fullwell_local_household_load` is truthfully read-only. Making load mutate the journal would silently break its MCP annotation, so compatibility repair must remain an explicit update operation even though the agent invokes it automatically without asking.
- 2026-07-26: A delivery dish can also be cited by a local meal-plan proposal. Identifier repair must update that proposal's item ID, deterministic content revision, and exact idempotency receipt fingerprint or a later replay can fail.
- 2026-07-26: A generic `VALIDATION_FAILED` trigger is too broad. The read-only parser can recognize the exact legacy-ID condition without writing and surface a dedicated compatibility-required code; privacy violations, malformed JSON, lock contention, and unrelated corruption must never enter automatic repair.
- 2026-07-26: Revision 460 also contains one history item whose own five evidence records use two exact restaurant display names while every other canonical restaurant, location, dish, and classification field matches. A safe repair partitions those occurrences into two items and report rows instead of overwriting either name.
- 2026-07-26: Revision 460 uses the legacy `delivery_history` report type, has one stale optional report summary, and retains bounded `authorized_browser` labels in the grocery and recipe profiles. These are recognized legacy fields: normalize the report from exact evidence and remove the labels without touching browser state or other profile data.

## Decision Log

- 2026-07-26: Add `repair_compatibility` to `fullwell_local_household_update`, not a direct file-edit instruction and not a mutating load. This preserves the stable narrow tool boundary and truthful read/write annotations.
- 2026-07-26: Recognize only bounded lowercase legacy delivery-dish IDs that retain the `itm_` namespace and fail only the current length rule. Derive replacements from a versioned SHA-256 mapping of the old ID. Reject collisions, duplicate legacy IDs, unsupported characters, and unrelated corruption rather than guessing.
- 2026-07-26: Repair every defined reference in one locked atomic revision: delivery item IDs, delivery-report item citations, local delivery-dish meal-plan sources, their content revisions, and their meal-proposal idempotency fingerprints. Parse and validate the complete repaired document before replacing the private file.
- 2026-07-26: The operation never contacts cloud and never retries a hosted write itself. The shared agent skill owns the conversational sequence: repair, reload, rebuild the provider payload from the new revision, then resume the already-authorized provider sync with its existing visibility/retention boundary.
- 2026-07-26: User-facing recovery language describes what happened to “saved delivery history,” what Fullwell did, and whether anything was shared. It does not expose internal terms such as connector, journal validation, schema, malformed ID, migration operation, or compatibility repair.
- 2026-07-26: Automatic repair triggers only on `LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED`. Other local errors retain their existing typed behavior and cannot be routed through the repair tool merely because they contain a validation-like message.
- 2026-07-26: A dry compatibility transform may remove only the exact obsolete `authorized_browser` string fields from `snacks` and `recipes`; any other prohibited field still fails closed. It may split a delivery item only when every cited evidence record exists and partitions by exact restaurant name with all other identity fields equal.

## Context and Orientation

The installable agent package is `packages/agent-client/`. Its dependency-free local MCP server is `packages/agent-client/runtime/local-household-mcp.mjs`, and the revisioned private-file implementation is `packages/agent-client/runtime/local-household.mjs`. `fullwell_local_household_load` is read-only. `fullwell_local_household_update` already owns ordinary non-destructive local mutations and is the correct authority for a compatibility update.

The local household document lives beneath the active Codex home's private Fullwell local directory. The runtime validates delivery items against `ITEM_ID_PATTERN`, validates delivery report citations, and atomically replaces the file under a private lock. Cloud household data is separate and must not be contacted by the repair.

The delivery workflow is governed by `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md`, `packages/agent-client/skills/manage-household-food-journal/SKILL.md`, and the privacy/tool references beside them. Agent behavior is regression-tested through `packages/agent-client/evals/` and `packages/agent-client/tests/evals/matrix.test.mjs`. Deterministic runtime and MCP coverage lives in `packages/agent-client/tests/packaging/`.

Assumptions:

- The legacy ID namespace was intended to identify one existing delivery dish; changing only its opaque identifier and exact references does not change its semantic identity.
- A recognized compatibility repair is low-risk and does not require user confirmation because it is local, deterministic, non-deleting, fully validated before commit, and does not share data.
- A previously granted provider visibility confirmation remains the authority for resuming the interrupted provider sync, but the repaired local revision requires rebuilding the exact payload and staging a matching promotion fingerprint.
- Package version 1.1.16 is available for an immutable patch release.

## Framing Notes

### Expert panel

- UX expert - prevent internal architecture language and dead-end handoffs.
- Local data-integrity engineer - preserve every record and reference through an atomic migration.
- Reliability engineer - make repair and retry idempotent under crashes, concurrent loads, and repeated agent calls.
- Applied-ML/evals engineer - ensure the agent recognizes the error and continues without asking unnecessary questions.

### What problem are we actually solving?

A predictable format evolution currently turns preserved local history into an unusable state and makes the user coordinate an internal engineering repair. Fullwell should absorb safe compatibility work and keep the user focused on their goal.

### Roundtable highlights

- UX: report the outcome, not the mechanism; say the saved history was updated and the original task is continuing.
- Data integrity: transform only known identifier references, validate the entire result, and leave the original file untouched on any uncertainty.
- Reliability: use the existing private lock and atomic replacement, increment one revision, make repeat calls return `already_compatible`, and rebuild any later cloud payload from the repaired revision.
- Evals: cover clear auto-repair, repeat repair, unrecoverable ambiguity, no jargon, no direct edits, and automatic continuation of the interrupted action.

### Key tensions

- Automatic recovery must not turn a read-only tool into a hidden mutation.
- Reference repair must be complete without becoming a generic recursive string replacement.
- Friendly language must not hide whether local or cloud data changed.

### Failure-oriented critique

- Data-integrity critic: broad validation-error recovery could rewrite unrelated corruption. Required change: add a specific read-only detection code and make it the only automatic trigger.
- Privacy critic: repair diagnostics could expose item IDs or private delivery fields. Required change: return counts and status only, and assert this in MCP tests.
- Reliability critic: repairing a meal-plan source without its idempotency fingerprint would break exact replay. Required change: recompute the receipt from the repaired stored proposal and test replay.
- UX critic: an unsuccessful generic repair could produce another dead end. Required change: never advertise a future engineering fix; state that the saved history is safe, name what Fullwell can still do, and ask only a concrete question whose answer enables a bounded repair.
- Release critic: a package-unit pass alone would not prove the installed host uses the new code. Required change: registry checksum verification, exact reinstall, installed-file inspection, and a real local repair/reload check without cloud upload.

### Synthesis for decomposition

Implement and prove the narrow data migration first, then expose it through the existing typed update boundary, then teach and evaluate the agent recovery loop, and only then publish/reinstall and exercise the real affected journal.

## Milestones

### Milestone 1 - Deterministic local compatibility repair

Files:

- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`

Tasks:

1. Add narrowly recognized legacy delivery-journal transforms, a read-only preflight that maps only a completely dry-repairable document to `LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED`, and versioned deterministic ID functions.
2. Add `repair_compatibility` parsing and runtime dispatch through `fullwell_local_household_update`; it is the only supported response to that dedicated code.
3. Under the existing private lock, read bounded raw JSON, rewrite only canonical delivery item/report/meal-plan references, partition mixed restaurant-name occurrences only from exact evidence, normalize report summaries, remove exact obsolete browser labels, recompute affected local item revisions and meal-proposal receipt fingerprints, validate the complete document, increment one revision, and atomically replace the file.
4. Return bounded counts and `repaired` or `already_compatible`; never return private item names, provider locators, or identifier mappings.
5. Reject collisions, duplicate legacy IDs, unsupported identifier shapes, missing evidence, non-identical restaurant identity fields, remaining prohibited data, or any other invalid document without writing.
6. Test the exact five-ID legacy shape, report references, meal-plan references, replay fingerprints, repeat repair, cloud-link staleness, no cloud interaction, collision/failure preservation, and MCP schema/dispatch.
7. Prove malformed JSON, prohibited local data, unrelated invalid fields, and lock contention do not surface the compatibility code and do not trigger repair.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`

### Milestone 2 - Automatic agent recovery and plain-language UX

Files:

- `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`

Tasks:

1. Instruct Fullwell to call `repair_compatibility` automatically only after `LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED`, reload, and resume the exact interrupted task once.
2. Rebuild a provider promotion from the repaired local revision; do not claim the prior payload is still current and do not weaken provider visibility consent.
3. For a successful repair, say only that Fullwell updated the saved delivery history and is continuing. For an unsafe repair, preserve all data and ask one concrete ordinary-language question only when the answer can unblock a safe transformation.
4. Add evals that forbid exposing connector, schema, validation, malformed-ID, migration-operation, or “Fullwell needs to add” dead-end language to an ordinary user.
5. Update normative client/server and architecture guidance.

Verification:

- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run build --workspace @fullwell/fullwell`

### Milestone 3 - Release and installed recovery

Files:

- `packages/agent-client/package.json`
- `package-lock.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `packages/agent-client/install-metadata.json`
- `packages/agent-client/README.md`
- `packages/agent-client/CHANGELOG.md`
- `CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`

Tasks:

1. Prepare immutable package version `1.1.16`, refresh every marketplace/install version surface, and document the repair.
2. Run the narrow and full repository gates plus exact dry-pack and isolated host lifecycle checks.
3. Commit and push the reviewed change with the required `AI-Model` trailer.
4. Publish and registry-verify `@fullwell/fullwell@1.1.16`, refresh the marketplace, and reinstall the exact version.
5. Exercise the installed repair against the affected local journal, verify one revision increment, all 511 delivery order lines remain, and the normalized 138-dish/24-row index reloads successfully. Do not upload or alter DoorDash cloud data during this repair verification.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm pack --workspace @fullwell/fullwell --dry-run --json`
- `npm view @fullwell/fullwell@1.1.16 version dist.shasum dist.integrity --json`
- `codex plugin list`

## Acceptance / Verification

- A local revision-460 journal containing the five observed legacy delivery IDs repairs through the supported local update tool without direct file editing.
- The repair preserves 81 completed orders, all 511 purchased item occurrences, provider profiles, meal-plan references, and existing local/cloud authority records. It normalizes the 137 legacy dish records and 23 report rows into 138 exact dishes and 24 exact restaurant/location rows because one old item combined two evidence-backed restaurant display names.
- The repaired document passes the complete current validator, increments exactly one local revision, marks an older cloud backup stale through the existing revision rule, and returns no private content in repair metadata.
- Repeating the repair is a no-op with `already_compatible`; a crash before atomic rename leaves the original intact; a collision or unknown corruption writes nothing.
- The agent automatically repairs, reloads, rebuilds the affected provider payload, and resumes the interrupted user goal instead of asking the user to understand Fullwell internals or wait for a future product fix.
- No repair step contacts Fullwell cloud, uploads DoorDash data, edits a delivery cart, or changes checkout authority.
- All commands listed in Milestones 1-3 pass.

Runnable acceptance commands:

    npm run test:packaging --workspace @fullwell/fullwell
    npm run test:evals --workspace @fullwell/fullwell
    npm run verify
    npm run verify:docs
    npm run verify:execplan

Recovery and rollback:

- Before publication, rollback is removal of the new operation and version changes; no user file is touched by repository tests.
- The installed repair uses atomic replacement only after complete validation. On any failure, the existing file remains authoritative.
- After publication, do not unpublish. Correct any release defect with a new immutable patch version.
- Never restore the user's journal by overwriting it with fixture data or by deleting delivery history. A failed installed repair stops with the original revision and file intact.

## Outcomes & Retrospective

Pending implementation and installed-host verification.
