# Build Collaborative Household Meal Planning

## Purpose / Big Picture

Give a household a practical weekly meal-planning surface in both Fullwell modes:

- A local-only guest household can ask Codex or Claude to propose and remember meals without an account.
- A connected cloud household can see one shared week, and each owner or editor can add suggestions without overwriting anyone else's suggestion for the same slot.
- The agent can draw from evidence-backed Liked recipes already in the journal or, after explicit permission, research new recipes through the host's internet-search capability.
- Before suggesting meals or searching, the agent confirms allergies and food sensitivities, records an explicit answer including "none," and checks recipes against the exact confirmed constraint revision.
- The current Fullwell setup or onboarding automation can offer one personal host-native weekly planning check-in, defaulting to Sunday at 9:00 AM in the user's confirmed IANA time zone and remaining conversationally reschedulable, pausable, resumable, skippable, and removable.
- In either mode, chat remains concise but can offer an image-forward local recipe board that opens in the browser without a Fullwell login, Pinterest account, public share, or persistent local web server.

The observable concurrency rule is central: if Alice proposes an egg salad sandwich and Bob proposes pizza for Monday lunch at nearly the same time, the finished plan shows both. A proposal disappears from the active view only after an explicit, attributed withdrawal event. A later write never wins merely because it arrived last.

The feature must not claim food is allergy-safe. A Liked recipe is preference evidence, not ingredient-safety evidence. Internet pages are untrusted input, external recipes retain source provenance, and Fullwell's server remains LLM-free and search-provider-free.

The visual board is a private local snapshot, not another authority. It shows the same bounded recommendations as responsive cards with images, source links, reasons, status, meal slots, and compatibility caveats. It does not replace the chat bullets or the authenticated collaborative week view.

The weekly automation is a personal host-owned reminder, not a Fullwell content authority or a shared household setting. Its scheduled turn asks whether the user wants to plan and then waits. It never silently searches, selects meals, changes constraints, adds proposals, or publishes a board.

## Progress

- [x] 2026-07-23T20:01Z: Read the repository architecture, planning standard, context ledger, execution guide, product specifications, current local journal runtime, recipe skill, Git projector, mutation runner, web routes, and existing ideation prior art.
- [x] 2026-07-23T20:01Z: Framed the feature with household UX, distributed-systems, privacy and food-safety, applied-ML/evals, reliability, and accessibility perspectives; decomposed it into dependency-ordered milestones.
- [x] 2026-07-23T20:01Z: Ran the failure-oriented feature critique and added weekly constraint-review evidence, free-form meal sources, confirmed time zones, per-search disclosure consent, source-revision staleness, explicit withdrawal ownership, public-projection exclusion, and old-reader rollback gates.
- [x] 2026-07-23T20:01Z: Extended and re-critiqued the plan for a login-free local visual recipe board, including static-file authority, exact chat handoff, browser-open fallbacks, image privacy and provenance, CSP and escaping, bounded cleanup, responsive accessibility, and dual-host evidence.
- [x] 2026-07-23T22:13Z: Extended and re-critiqued the plan for a weekly host-native planning automation, including Sunday-morning confirmation, conversational schedule management, Codex/Claude capability gates, personal scheduler authority, DST and missed-run behavior, prompt deduplication, privacy, and orphan-safe rollback.
- [x] 2026-07-23T23:31Z: Revalidated scheduling against current official host documentation. Codex scheduled tasks can be created or updated from Codex chat, can explicitly invoke a skill, and can retain the current chat context; Claude Desktop tasks are likewise managed conversationally. Removed the speculative Fullwell automation receipt and MCP scheduler tool so the host task list remains the only scheduling authority.
- [x] 2026-07-24T00:28Z: Completed three full adversarial plan-review rounds. Feasibility and scope passed; completeness's final explicit-search-approval finding was corrected. The user explicitly overrode the exhausted review gate and authorized implementation of the corrected plan.
- [x] 2026-07-24T01:48Z: Completed work unit `fullwell-4m6.1`: added strict local/cloud meal-planning contracts, canonical time-zone and safe-URL boundaries, liked-recipe evidence compatibility rules, append-only path validation, and focused contract/server tests. All 42 focused assertions and workspace typechecks passed, followed by a fresh adversarial acceptance review with no blocking findings.
- [x] 2026-07-24T01:55Z: Completed work unit `fullwell-4m6.2`: mutation receipts now fan concurrent exact-key calls into the durable first writer under the household lock, while the explicit `append_to_current_head` policy accepts exactly one append-only change and leaves strict expected-head callers unchanged. The focused race/recovery suite and server typecheck passed, followed by a fresh adversarial acceptance review with no blocking findings.
- [x] 2026-07-24T02:12Z: Completed work unit `fullwell-4m6.3`: published the five bounded cloud tools; added the confirmed shared constraint profile, weekly reviews, commutative proposals, proposer/owner withdrawals, deterministic staleness, Git rebuild, Neon JSON projection, post-commit recovery, MCP descriptions, and server/architecture specifications. Focused tests, typecheck, security, load, migration up/down/up, and real Apple Container PostgreSQL integration passed. A fresh review found and verified the fix for completed constraint-update fingerprint enforcement, then passed the closure review.
- [x] 2026-07-24T02:38Z: Completed work unit `fullwell-4m6.4`: added bounded local profiles, weekly reviews, attributable append-only proposals and withdrawals, exact replay, current liked-recipe validation and staleness, purpose-specific fan-in locking, and the private static recipe-board renderer. The closure review drove fixes for legacy-save preservation, lock ABA and crash recovery, canonical time zones, profile idempotency, week bounds, board integrity and corrupt cleanup, and operation-discriminated MCP schemas. The final focused suite passed 26/26 with scoped lint, build, diff checks, and a fresh adversarial PASS.
- [x] 2026-07-24T03:33Z: Completed work unit `fullwell-4m6.5`: shipped the shared meal-planning conversation and setup handoff, privacy-bounded internet-research consent, exact visual-board offer and MCP/browser handoff, and one host-owned weekly task with explicit Codex/Claude routing, reconciliation, lifecycle, unavailability, and rollback behavior. The final package gates passed 12 executable host-behavior tests, 35 packaging tests, 51 required meal/scheduling cases within 105 total evals, and four responsive/no-JavaScript board projects; a fresh adversarial closure review passed with no blockers.
- [x] 2026-07-24T03:35Z: Completed work unit `fullwell-4m6.6`: added the authenticated shared week view and no-JavaScript review/add/withdraw flows, multi-proposal slots, role-aware withdrawals, stale warnings, safe HTML error recovery, PRG focus restoration, and responsive empty/read-only states. The closure cycle added a real cross-tenant authorization fixture and a two-principal browser race; 73 focused assertions, the 39-pass full WebKit matrix with 13 intentional project skips, and the 319-pass repository verify gate with 11 expected database skips all passed before a fresh adversarial PASS.
- [x] 2026-07-24T04:25Z: Completed work unit `fullwell-4m6.7` with synchronized product/privacy/reliability/release guidance and a complete local acceptance matrix. The first fresh review found stale rendered privacy copy and unbounded cloud week growth. The second found that a shared event quota could strand accepted proposals and that proposal pagination hid events after the first 200 proposals. The rendered policy now includes the meal-planning/search/board/task disclosures; local and cloud weeks enforce 500 proposals, 48 per date-and-slot, and separate reserves for 500 constraint reviews and 500 withdrawals; cloud reads return the complete bounded event set independently of proposal pagination; and exact replays remain available at capacity. Repository verification passes 324 tests with 11 database-gated skips; those 11 tests and all seven reversible migrations passed separately against Apple Container PostgreSQL. Contract and package gates pass 20 and 36 tests; security, load, restore, and native scheduling gates pass 10, 4, 1, and 12 tests; WebKit passes 39 applicable scenarios with 13 intentional matrix skips; accessibility passes six applicable checks with six intentional matrix skips; fully configured local deployment and MCP smokes pass; and the production dependency audit reports zero vulnerabilities after updating `find-my-way` to 9.7.0. All three fixture-only screencast attempts failed with Homebrew FFmpeg 8.0.1 exit code 234 because `x11grab` is unavailable, so no MP4 is claimed. A third fresh adversarial review reran the contract build, 38 cloud/contract/load tests, 36 local/package tests, and monorepo typecheck, then passed without blockers.
- [x] Milestone 0 - prove host-search, host-scheduling, privacy, compatibility, concurrency, and projection feasibility.
- [x] Milestone 1 - freeze meal-planning domain, contract, safety, and documentation rules.
- [x] Milestone 2 - implement cloud append-only storage, projection, authorization, and idempotency.
- [x] Milestone 3 - implement local-only planning and the shared Codex/Claude skill.
- [x] Milestone 4 - implement the weekly host-native planning automation.
- [x] Milestone 5 - implement the login-free local visual recipe board.
- [x] Milestone 6 - implement the connected-household week view and browser mutations.
- [x] Milestone 7 - complete adversarial, accessibility, release, deployment, and rollback evidence.

## Surprises & Discoveries

- 2026-07-23: Fullwell already distinguishes Saved, Cooked, and Liked recipe evidence, but has no week, meal slot, dietary-constraint profile, or meal-plan mutation.
- 2026-07-23: The local guest document's inner `journal` accepts bounded JSON and already rejects secret-like fields, so meal-planning state can likely be introduced without changing the strict outer schema. The generic `save` operation is still unsuitable for concurrent suggestions because it replaces the entire journal at an exact revision.
- 2026-07-23: The cloud `MutationRunner` already serializes writes under a household advisory lock and can use the current HEAD when `expectedHead` is null. The new append behavior can be narrow and typed; no existing mutable tool needs weaker conflict protection.
- 2026-07-23: `rebuildRepositoryState` deliberately ignores unknown repository documents. This helps forward compatibility, but Milestone 0 still must prove that deployment rollback neither loses the new paths nor advances a stale projection unsafely.
- 2026-07-23: The server has no recipe-search dependency by design. Web discovery must remain a Codex or Claude host action, with a deterministic fixture path for tests and an honest fallback when a host cannot search.
- 2026-07-23: The current profile type is limited to household, snacks, and recipes. Adding health-adjacent constraint content changes the privacy and agent-eval contract even if no database migration is needed.
- 2026-07-23: The local document revision advances for every local write, so it cannot represent a constraint-profile or recipe-content revision. Local state needs a nested monotonic constraint-profile revision and a deterministic digest of the validated recipe item; unrelated meal-plan appends must not make every proposal stale.
- 2026-07-23: Recipe items and public collection cards already carry image URL and audited-page provenance. The existing server specification supplies the correct visual safety baseline: external HTTPS only, no server fetch, restrictive CSP, no-referrer loading, lazy loading, dimensions, meaningful alt text, and a visible fallback.
- 2026-07-23: A local `file://` snapshot avoids accounts, cloud publication, listener lifecycle, port conflicts, and local HTTP attack surface, but Codex and Claude host surfaces may differ in whether a local link is clickable or requires an explicit browser-open action.
- 2026-07-23: The repository screencast helper currently depends on Linux `x11grab`; Homebrew FFmpeg on this macOS host exits with code 234. The implementation must attempt the required capture and retain browser screenshots and assertions if that known limitation recurs.
- 2026-07-23: Official Codex [Scheduled tasks](https://learn.chatgpt.com/docs/automations) documentation says Codex chat can create or update a task, an existing chat can be scheduled to retain context, and a scheduled task can explicitly invoke a skill. Fullwell therefore needs a shared skill and host-confirmed conversational setup, not a scheduler adapter or local receipt.
- 2026-07-23: Official [Claude Code Desktop scheduling documentation](https://code.claude.com/docs/en/desktop-scheduled-tasks) says a user can create, list, edit, pause, and resume scheduled tasks by asking Claude in any Desktop session. Those local tasks start fresh sessions, require the app to be open and the computer awake, skip missed runs, and may start a few minutes late. [Claude Cowork scheduled tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork) run remotely as separate sessions. The plan must select by required local-data access and report these semantics honestly.

## Decision Log

- 2026-07-23: Model a meal slot as an unordered set of immutable proposals, not a single recipe field. This makes concurrent additions commutative and matches the user's explicit "add both" requirement.
- 2026-07-23: Record withdrawal as an append-only event rather than deleting or rewriting the proposal. This preserves attribution and Git audit history.
- 2026-07-23: In cloud mode, the proposing actor may withdraw their own proposal and a household owner may withdraw any proposal with attribution; editors cannot withdraw another person's proposal. Local-only mode has no authenticated membership boundary, so it records a user-confirmed local actor label for attribution but allows the local operator to withdraw any local proposal explicitly.
- 2026-07-23: Bind every proposal to an exact meal-planning constraint profile revision and a weekly constraint-review event. When the profile or cited journal recipe changes, older proposals become `needs_recheck` deterministically.
- 2026-07-23: Require an explicit allergy and sensitivity answer before suggestions or search. Never infer a health constraint or severity, and never describe a result as allergy-safe.
- 2026-07-23: Ask separately before putting constraints into each external search query. Consent is single-search and is not stored as a blanket preference. If the user declines, search broad terms and inspect ingredients locally, or use known recipes only.
- 2026-07-23: Keep internet research in Codex or Claude host tools. The server accepts only a bounded selected recipe reference and never fetches a page, invokes an LLM, or stores raw search terms or page content.
- 2026-07-23: Keep strict expected-revision behavior for mutable profiles and existing tools. Add one explicit commutative-append mutation policy rather than treating every null `expectedHead` mutation as safely mergeable.
- 2026-07-23: Reuse the local document's existing process lock and atomic write. Add a purpose-specific idempotent operation that reloads current state under the lock instead of requiring a stale caller to resubmit the whole journal.
- 2026-07-23: Use a Monday-start ISO date plus a user-confirmed household IANA time zone as the week identity. The host may suggest its detected time zone, but the user confirms it before the first saved week. Store meal dates as calendar dates so DST changes do not move a meal to another day.
- 2026-07-23: Keep local-only planning conversational. The authenticated web week view is a cloud-household capability and is not a dependency for the local feature.
- 2026-07-23: Prefer no Neon migration because the projection is rebuildable JSON-shaped state. Milestone 0 must confirm this; any required schema change must have up/down/up proof and a documented rollback.
- 2026-07-23: Keep meal plans and their health-adjacent constraints out of public collection projections. Connected household members may read the shared profile; the onboarding copy asks for constraint labels needed for meals, not names or medical narratives.
- 2026-07-23: In local mode, increment a nested constraint-profile revision only when the constraint profile changes, and identify a cited recipe by a deterministic digest of its validated canonical item. The outer document revision remains the file-level concurrency token.
- 2026-07-23: Keep chat bullets as the primary answer and offer a visual board as an explicit local follow-up. A user request such as "show me visually" or an affirmative response to the offer authorizes board creation and a supported browser-open action.
- 2026-07-23: Generate a static HTML file rather than starting a loopback server. Use a narrow local renderer with no arbitrary paths, no scripts, no forms, no remote CSS or fonts, no image proxy, and no journal mutation.
- 2026-07-23: Permit direct HTTPS image loading only with visible source-site disclosure, preserved image-page provenance, `referrerpolicy="no-referrer"`, lazy loading, fixed dimensions, and a fallback. Do not download, proxy, cache, or invent recipe imagery.
- 2026-07-23: Use a responsive DOM-ordered CSS Grid rather than CSS multi-column masonry. This preserves keyboard and screen-reader order while retaining the dense, image-forward character the user described as Pinterest-style.
- 2026-07-23: Store unique board snapshots under Fullwell's private local directory with mode 0600 inside mode-0700 directories. Bound count, card count, bytes, and age; clean up only on later creation or explicit deletion, never through a background process.
- 2026-07-23: Let the existing Fullwell setup or onboarding automation offer the weekly check-in after its primary setup succeeds. Create no recurring task until the user confirms an exact weekday, clock time, and IANA time zone; use Sunday at 9:00 AM only as the offered default.
- 2026-07-23: Keep the actual recurring schedule and all lifecycle state in Codex or Claude. Before create or update, ask the host to list existing Fullwell meal-planning tasks and reconcile to one exact task; report success only from the host-confirmed result. Store no Fullwell-local scheduling receipt and never put personal reminder state in the journal, Git, Neon, public collections, or cloud exports.
- 2026-07-23: Use one schedule per user and host installation rather than one shared household schedule. Multiple cloud members may each opt in without changing one another's reminder.
- 2026-07-23: The scheduled instruction asks to start the planning conversation and waits for the user. It contains no household title, recipe, constraint, search term, actor identity, or credential and grants no authority to search or mutate.
- 2026-07-23: Distinguish a permanent recurring change from a one-week skip or deferral. If ordinary language such as "move it to Tuesday" is ambiguous, ask which scope the user intends before changing host state.
- 2026-07-23: Ship native task discovery, pause, and deletion guidance before enabling creation. A host timeout or unknown result remains explicitly unconfirmed; rollback pauses or removes active tasks before schedule-creation guidance is withdrawn.

## Context and Orientation

Fullwell has two content authorities:

- Local-only mode stores one bounded, revisioned document at the active Codex home's `fullwell/local/household.json`. `packages/agent-client/runtime/local-household.mjs` owns validation, locking, atomic replacement, and recovery. `packages/agent-client/runtime/local-household-mcp.mjs` exposes the stable named local tools.
- Cloud mode stores authoritative household content in a signed Git repository. `apps/server/src/services/mutation-runner.ts` owns durable idempotency and mutation state transitions; `apps/server/src/git/git-repository.ts` is the sole Git writer; `apps/server/src/domain/repository-projection.ts` rebuilds disposable operational state; Neon stores authorization, mutation, and projection state.

The current recipe domain is in `packages/contracts/src/domain.ts`. Tool inputs are in `packages/contracts/src/tools.ts`. `packages/agent-client/skills/track-recipe-history/SKILL.md` requires Codex or Claude to decide recipe identity and keep Saved, Cooked, and Liked independent. `packages/agent-client/references/semantic-food-rules.md` prohibits program code from making semantic food decisions.

The cloud MCP service is implemented in `apps/server/src/services/household-food-journal.ts` and exposed through `apps/server/src/http/app.ts`. The authenticated React surface is split between `apps/server/src/http/web.ts`, `apps/server/src/http/web-view-model.ts`, and `apps/web/src/`. React remains a presentation boundary; the server owns membership authorization, CSRF, idempotency, validation, and mutations.

For this plan:

- A **week** is seven local calendar dates beginning on a validated Monday in one household IANA time zone.
- A **slot** is one date plus breakfast, lunch, dinner, snack, or a bounded custom label.
- A **proposal** is one immutable meal suggestion in a slot. A slot may contain several.
- A **constraint profile** is the household-visible answer about allergies and food sensitivities relevant to meal planning.
- A **constraint revision** is the profile blob revision in cloud mode or a nested meal-planning profile revision in local-only mode. It does not change for unrelated proposal appends.
- A **weekly constraint review** is an immutable event proving that a user saw the current shared constraints and answered whether they changed for that week.
- A **withdrawal event** makes a proposal inactive without deleting its historical record.
- A **commutative append** is a mutation whose result remains valid when another independent append reaches the repository first. It still requires current authorization, durable idempotency, bounded input, and the household lock.
- A **visual recipe board** is an immutable local HTML snapshot of bounded recommendation cards. It is presentation only, has no login or edit authority, and may be built from already-read local or cloud data.
- A **weekly planning automation** is one personal recurring task owned by the Codex or Claude host. It initiates a planning check-in but is not journal, Git, Neon, calendar, or notification authority.

The planned cloud repository layout is:

    profiles/meal-planning.md
    meal-plans/weeks/<monday-date>/proposals/<proposal-id>.json
    meal-plans/weeks/<monday-date>/events/<event-id>.json

The server derives every path from validated dates and generated semantic IDs. Callers never provide a path, ref, commit message, commit author, or Git argument. Proposal and event paths are append-only. The profile remains a revision-checked mutable document.

The local representation should live inside the existing bounded `journal`, tentatively under `journal.meal_planning`, so old outer-document readers still recognize schema version 1. Milestone 0 must verify actual backward and rollback behavior before this becomes a frozen contract.

Visual boards live separately from the journal, tentatively under `fullwell/local/views/recipe-boards/<board-id>/index.html` inside the active Fullwell local root. The local runtime generates `board-id`, validates and escapes every card, creates private directories without following symbolic links, writes atomically, and returns the absolute path plus a correctly encoded `file://` URL. A board does not require a local guest household to exist, so a connected-cloud conversation can render already-authorized recommendation results without making the browser authenticate again.

## Framing Notes

### Expert panel

- Household product and information-architecture lead - defines collaborative slots, weekly review, proposal withdrawal, the optional visual-board offer, and ordinary user language.
- Habit and host-automation product lead - defines opt-in timing, exact schedule confirmation, rescheduling language, one-week deferral, non-nagging behavior, and host-specific fallback.
- Distributed-systems and Git architect - defines append semantics, idempotency, locking, projections, repository paths, reconciliation, and rollback.
- Privacy and food-safety specialist - defines constraint collection, shared visibility, external-search consent, safe claims, and log redaction.
- Applied ML and eval specialist - defines preference grounding, source provenance, ingredient uncertainty, prompt-injection behavior, and cross-host evals.
- Reliability and accessibility engineer - defines local race handling, cloud race tests, private board creation and cleanup, browser-open fallback, time zones, responsive layout, and release evidence.

### Synthesis

The feature is not a calendar whose cells hold one recipe. It is a proposal ledger rendered as a week. That distinction removes the destructive last-writer-wins behavior while keeping explicit household decisions possible later.

Food constraints are not an optional recommendation refinement. The agent must establish an explicit state before it proposes food: unresolved, confirmed none, or recorded constraints. Each week also needs an append-only review event; a profile revision alone does not prove that the question was asked for that week. A profile or cited journal-recipe revision change invalidates prior review but does not delete history.

External research is useful only when its provenance and uncertainty remain visible. The selected proposal can retain a canonical HTTPS recipe reference, but it cannot silently gain journal statuses or a guarantee based on incomplete ingredients.

The visual supplement should feel immediate but remain technically modest. The renderer receives decisions the agent already made and turns them into a script-free local snapshot. It does not search, rank, classify, mutate the journal, publish data, or become a second meal-plan state.

The recurring check-in should likewise feel like the same helpful conversation, not a background meal-planning robot. Host scheduling wakes or starts a Fullwell-capable session with a fixed non-sensitive instruction. The task first deduplicates the current week, then asks whether the user is ready and whether constraints changed. Search, proposal writes, and visual output remain downstream user-directed actions.

### Failure questions resolved by this plan

- Two principals add to the same slot: serialize both appends under the household lock, append two distinct paths to successive current HEADs, and show both.
- One principal retries: durable idempotency and a stable fingerprint return the original proposal and commit.
- An idempotency key is reused with changed input: return `REVISION_CONFLICT`; do not create a second proposal.
- A profile changes after proposals exist: retain proposals and derive `needs_recheck`.
- The host cannot search the web: use journal recipes or report the capability limitation without inventing results.
- Search consent is declined: do not put constraints into external queries; offer broad search plus local ingredient review or known recipes only. Never carry consent from one search into another.
- A page contains instructions for the agent: treat all page content as untrusted recipe data.
- Ingredients or cross-contact details are incomplete: label the compatibility review incomplete and do not claim safety.
- A local process dies while writing: reuse the existing atomic temp-file, fsync, rename, and stale-lock recovery behavior.
- Git commits but projection update fails: retain the existing `reconciliation_required` state and rebuild from Git.
- A chat surface blocks `file://` links: return the path and use a supported permission-visible browser-open action only after the user asks; otherwise say that the board was created but not opened.
- The host cannot open local HTML: keep the normal chat bullets and return an honest unsupported-capability message rather than starting an unplanned listener.
- A card has no safe image URL or its image host blocks anonymous loading: render a styled text fallback and retain the recipe source link; never search for an unrelated image.
- A recipe title, reason, URL, or image URL contains markup or an unsafe scheme: escape text, reject the URL, and render a fallback card without executable content.
- The current automation cannot programmatically create another: present a supported prefilled create/confirmation action and wait for the host's success result; never simulate unsupported UI or say the schedule exists.
- Schedule creation times out after the host may have accepted it: inspect the host's native task list for the stable Fullwell task name and reconcile to exactly one task before retrying; do not claim success while the host result is unknown.
- The device sleeps through a Claude Code Desktop run: accept the documented skipped run, allow at most one later Fullwell catch-up check-in, and never enqueue one prompt per missed interval.
- DST starts or ends: keep the confirmed local wall-clock time in the IANA time zone. A detected time-zone change requires confirmation before host rescheduling.
- The user says "move it to Tuesday": ask whether that means only this week or every week unless the surrounding request makes the scope explicit.
- Two cloud members enable reminders: retain two independent personal host tasks; neither task writes shared reminder state, and each scheduled session checks the current week before prompting or mutating.
- The package is rolled back while a schedule exists: pause or delete the task before removing creation support; if cleanup cannot complete, leave a harmless fixed prompt that reports repair guidance rather than attempting unavailable tools.

## Interfaces and Dependencies

Milestone 1 should freeze semantic types similar to the following; names may change during the spike, but invalid states must remain unrepresentable:

    MealPlanningConstraints =
      | { status: "unresolved" }
      | {
          status: "confirmed_none";
          time_zone: IanaTimeZone;
          reviewed_at: ISODateTime;
        }
      | {
          status: "recorded";
          time_zone: IanaTimeZone;
          allergy_labels: BoundedText[];
          sensitivity_labels: BoundedText[];
          reviewed_at: ISODateTime;
        }

    MealSource =
      | {
          kind: "freeform";
          title: BoundedText;
        }
      | {
          kind: "journal_recipe";
          item_id: ItemId;
          item_revision: GitObjectId | LocalRecipeContentDigest;
          liked_evidence_ids: EvidenceId[];
        }
      | {
          kind: "external_recipe";
          title: BoundedText;
          canonical_url: SafeHttpsUrl;
          site_name: BoundedText;
          discovered_at: ISODateTime;
        }

    MealProposal = {
      id: MealProposalId;
      week_start: ISODate;
      meal_date: ISODate;
      slot: MealSlot;
      proposed_by: ActorId | LocalActor;
      source: MealSource;
      servings: PositiveBoundedInteger | null;
      notes: BoundedText | null;
      constraint_revision: GitObjectId | LocalMealPlanningProfileRevision;
      constraint_review_event_id: MealPlanEventId;
      compatibility: "appears_compatible" | "incomplete_evidence" | "needs_recheck";
      compatibility_caveat: BoundedText;
      created_at: ISODateTime;
    }

    LocalActor = {
      kind: "local";
      label: BoundedText;
    }

    MealPlanEvent =
      | {
          id: MealPlanEventId;
          kind: "constraints_reviewed";
          week_start: ISODate;
          constraint_revision: GitObjectId | LocalMealPlanningProfileRevision;
          actor_id: ActorId | LocalActor;
          occurred_at: ISODateTime;
        }
      | {
          id: MealPlanEventId;
          kind: "withdrawn";
          proposal_id: MealProposalId;
          actor_id: ActorId | LocalActor;
          reason: BoundedText | null;
          occurred_at: ISODateTime;
        }

    RecipeBoardCard = {
      id: RecipeBoardCardId;
      title: BoundedText;
      image_url: SafeHttpsUrl | null;
      image_page_url: SafeHttpsUrl | null;
      recipe_url: SafeHttpsUrl | null;
      source_label: BoundedText;
      why_recommended: BoundedText;
      journal_statuses: ("Saved" | "Cooked" | "Liked")[];
      proposed_slot: BoundedText | null;
      compatibility: "appears_compatible" | "incomplete_evidence" | "needs_recheck";
      compatibility_caveat: BoundedText;
    }

    RecipeBoardCreateInput = {
      idempotency_key: LocalIdempotencyKey;
      title: BoundedText;
      context_label: BoundedText | null;
      cards: RecipeBoardCard[];
    }

    RecipeBoardCreateResult = {
      board_id: LocalRecipeBoardId;
      file_path: AbsoluteLocalPath;
      file_url: FileUrl;
      card_count: PositiveBoundedInteger;
      remote_image_count: BoundedInteger;
      created_at: ISODateTime;
    }

The exact profile Markdown/frontmatter contract must distinguish an unanswered question from an explicit "none." The server validates structure and bounds but does not interpret the allergy or sensitivity text. Local state stores a nested `profile_revision` that increments only when this profile changes. A local journal-recipe source uses a deterministic digest of the validated canonical item as its `item_revision`; the outer local document revision remains only the file-level lock and compare token.

The board contract permits at most 48 cards and one safe image, image-page, and recipe URL per card. It rejects URL credentials, non-HTTPS schemes, local paths, control characters, unsupported fields, excess text, and excess serialized bytes. An image URL is accepted only with its audited image-page URL. The renderer creates all markup itself; callers cannot provide HTML, CSS, attributes, filenames, paths, scripts, or CSP text.

Planned cloud tools:

- `hfj_get_meal_plan`: read one bounded week plus constraint-review metadata. Require `journal:read`, hide cross-household existence, and paginate or cap proposals and events.
- `hfj_review_meal_constraints`: append one immutable weekly review event for the current constraint profile revision. Require owner/editor plus `journal:write`.
- `hfj_add_meal_proposal`: add one immutable proposal. Require owner/editor plus `journal:write`, a validated household/week/slot/source, the current constraint revision, a review event for that revision and week, idempotency key, and request fingerprint.
- `hfj_withdraw_meal_proposal`: append one explicit withdrawal event. Require the proposing actor or a household owner plus `journal:write`; an editor cannot withdraw another actor's proposal.
- Reuse `hfj_get_profile` and `hfj_update_profile` after adding `meal_planning` to the profile enum, or add a narrower constraint-profile mutation if privacy and type clarity justify it.

Planned local operations under `fullwell_local_household_update`:

- `save_meal_planning_profile` with expected local revision and a user-confirmed local actor label;
- `review_meal_constraints` with a stable local idempotency key and local actor label;
- `append_meal_proposal` with a stable local idempotency key, local actor label, and no whole-document replacement;
- `record_meal_plan_event` with a stable local idempotency key and local actor label.

The local update tool is already a named, user-approved write boundary. Keep these operations inside it instead of adding arbitrary filesystem access or a second broad mutation tool. A local actor label is attribution, not authentication: the skill confirms the label before the first local write, proposals retain it, and local withdrawals record the current label without pretending to enforce cloud membership roles.

The visual renderer is intentionally a separate narrow local MCP tool:

- `fullwell_local_recipe_board_create`: accept only `RecipeBoardCreateInput`, derive a board ID and content fingerprint from the stable local idempotency key, create the private snapshot, perform bounded generated-board eviction, and return `RecipeBoardCreateResult`.

The renderer does not load the journal, call Fullwell cloud, search, fetch images, or open the browser. The meal-planning skill supplies cards from data already authorized in the current conversation. Browser opening remains a separate host capability used only after an explicit visual/open request. This separation keeps the tool permission accurate: it creates one local presentation artifact but has no arbitrary filesystem or browser authority.

Weekly scheduling has no Fullwell runtime or MCP contract. The shared skill asks the current Codex or Claude host to list tasks with the stable name `Fullwell weekly meal planning`, reconciles duplicates before any create or update, and then uses the host's documented conversational task action. The host task list and host-confirmed lifecycle result are the sole authority. Fullwell stores no schedule identifier, cadence, task state, or prompt history locally or in cloud data. A one-week skip or deferral uses the host's documented one-occurrence behavior and never silently rewrites the recurring cadence.

For cloud proposal additions, extend `MutationRunner` with a semantic conflict policy rather than relying on a bare null `expectedHead` at call sites:

- `strict_expected_head`: current behavior for mutable documents.
- `append_to_current_head`: allowed only for server-generated, append-only paths whose semantic input has a durable fingerprint.

The append policy retains the state machine:

    received -> locked -> git_committed -> projections_applied -> completed

It also retains:

    received/locked -> failed_before_commit
    git_committed -> reconciliation_required -> completed or quarantined

Under `append_to_current_head`, the lock holder reloads the current HEAD, rechecks membership against that HEAD, builds one unique path from the durable request ID, commits against the current HEAD, and applies the projection. Existing strict mutations are unchanged.

No external SDK belongs in the domain. Internet search and scheduling use host-supported Codex or Claude capabilities. Deterministic evals exercise the required host conversation and success-reporting contract; they do not depend on the live internet or an undocumented scheduler API.

## Milestones

### Milestone 0 - Feasibility and compatibility contract

Files:

- `docs/exec-plans/completed/2026-07-23-collaborative-household-meal-planning.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/design/weekly-meal-planning-automation.md` (new)
- `packages/agent-client/README.md`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/runtime/local-household.mjs`
- `apps/server/src/services/mutation-runner.ts`
- `apps/server/src/services/mutation-runner.test.ts` (new)
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/git/git-repository.ts`

Tasks:

1. Build a current host capability matrix for supported Codex and Claude internet search, local `file://` link rendering, permission-visible browser-open tools, and durable weekly scheduling. Record CLI and desktop behavior, whether a local link is clickable, the supported fallback, how failure is reported, and which content reaches each provider. Do not build on undocumented UI automation.
2. For scheduling, prove create, discover/list, exact retry, edit cadence, pause, resume, delete, one-time run or skip, and run-history behavior on each supported host. Specifically verify whether the current Fullwell setup or onboarding automation can invoke creation, whether Codex can wake the same thread, whether Claude starts a fresh scheduled session, and which surfaces require the device/app to remain available. Public documentation is evidence of capability, not proof of the installed host integration.
3. Freeze the fallback when the current surface cannot manage a native task: show the exact supported task instruction and schedule, then wait for the host's explicit success result. Do not claim creation from an instruction, UI appearance, or timeout.
4. Define and review the food-constraint question, shared-household visibility notice, weekly "any changes?" check, append-only review event, single-search external disclosure consent, compatibility caveats, and incomplete-ingredient behavior with privacy and food-safety lenses. Ask for constraint labels needed for shared meals without names or medical narratives.
5. Create a fixture-only flow that selects a known Liked recipe and a fixture external recipe. Prove the external source retains URL and discovery provenance but gains no Saved, Cooked, or Liked status.
6. Prototype two cloud proposal additions using unique paths under the existing household lock and capture the proof in the new focused mutation-runner test. Prove egg salad and pizza both commit to Monday lunch, exact retry creates one proposal, changed idempotency reuse conflicts, and existing strict mutations still conflict at stale HEAD.
7. Prototype the local append operation with two processes starting from the same document revision. Prove the file lock preserves both proposals and exact retry does not duplicate.
8. Test an outer-schema-v1 local reader against a document containing `journal.meal_planning`. If a released reader rewrites or rejects the inner state, design a two-phase compatible representation before implementation.
9. Test new proposal/event paths with the current projector, backup, export, restore, and a rolled-back server binary. Confirm unknown paths are preserved and do not cause stale authorization or a destructive rewrite. If this cannot be proven, require a two-phase read-compatible server release before enabling writes.
10. Decide whether the existing projection storage can hold meal-plan maps without a Neon schema change. If not, add a reversible migration milestone with up/down/up and old-binary evidence.
11. Prototype a fixture-only board with malicious titles and URLs, missing images, a blocked image host, and 48 cards. Prove path confinement, mode 0700/0600, symlink rejection, atomic retry, CSP, text escaping, no script/form/network fetch in the renderer, DOM reading order, no allergy labels, and bounded old-board cleanup.
12. Verify the privacy/UX copy: "Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required. Images load from their source sites." A yes authorizes creation and a supported open action for this board only.
13. Freeze limits for weeks returned, proposals per slot/week, events, notes, custom slot labels, URL length, servings, constraint labels, local actor labels, board cards, board bytes, retained boards, and board age. Freeze the stable native task name, cloud proposer-or-owner withdrawal rule, explicit local-withdrawal attribution, and confirmed household-time-zone flow.
14. Record the spike evidence and decisions in this plan before Milestone 1. Unresolved host opening must leave chat bullets usable; unresolved nested schedule creation must leave a supported user-confirmed handoff; unresolved rollback safety blocks cloud writes; none blocks a safe local known-recipe slice.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npx vitest run apps/server/src/services/mutation-runner.test.ts apps/server/src/domain/repository-projection.test.ts apps/server/src/git/git-repository.test.ts`
- `npm run test:restore`
- `npm run verify:docs`
- `npm run verify:execplan`

Exit evidence:

- a host capability and privacy matrix;
- a host scheduling matrix with documented and installed create/discover/edit/pause/resume/delete semantics, local-data availability, sleep/missed-run behavior, and nested-automation evidence;
- a successful child-schedule transcript or a supported prefilled confirmation handoff that never claims premature success;
- a file-link/browser-open matrix for clean Codex and Claude installs;
- a malicious-input board fixture with private-mode, CSP, accessibility, and cleanup results;
- a weekly review record tied to the current constraint revision and confirmed time zone;
- a two-principal cloud race transcript with two unique proposal paths;
- a two-process local race fixture with two proposals;
- old-reader and old-server rollback results;
- a recorded no-migration decision or a reversible migration design;
- frozen bounds and user-facing safety copy.

### Milestone 1 - Domain, contracts, safety rules, and normative docs

Files:

- `packages/contracts/src/domain.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/core/types.ts`
- `apps/server/src/core/ports.ts`
- `apps/server/src/domain/journal-validation.ts`
- `apps/server/src/domain/journal-validation.test.ts`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/design/weekly-meal-planning-automation.md` (new)

Tasks:

1. Add branded meal proposal/event identifiers, validated Monday/date/slot schemas, source discriminated unions, constraint states, compatibility states, and bounded tool inputs and outputs.
2. Add `meal_planning` to the private profile contract. Preserve explicit unresolved, confirmed-none, and recorded states plus a user-confirmed IANA time zone; do not use empty fields to mean more than one state.
3. Require a proposal date to fall within its week, validate week start as Monday, and interpret dates through the confirmed household time zone without converting meal dates through UTC.
4. Add an immutable weekly constraint-review event. Require every proposal to cite a review for the same week and current constraint revision. Derive `needs_recheck` when the current profile or cited journal recipe revision differs rather than rewriting the proposal.
5. Validate free-form meal sources as bounded titles. Validate journal-recipe references against current items and evidence revisions. Permit Liked evidence as a preference signal, but do not treat it as compatibility evidence.
6. Validate external sources as bounded canonical HTTPS references. Exclude raw HTML, page text, search query, redirects, cookies, screenshots, and arbitrary metadata.
7. Freeze cloud proposer-or-owner withdrawal authorization, local label-only attribution, board input/result schemas, size limits, stable error codes, privacy redaction, public-collection exclusion, and feature-capability discovery.
8. Define the board as a local derived artifact rather than journal or cloud authority. Specify file permissions, location, idempotency, retention, cleanup, remote-image disclosure, CSP, escaping, and browser-open fallback in the client specification.
9. Freeze the native host task lifecycle separately from shared meal-planning contracts. Specify Sunday at 9:00 AM as a confirmed default, IANA wall-clock behavior, personal-per-host ownership, one-week versus permanent changes, exact host success evidence, duplicate reconciliation through the host task list, non-sensitive fixed instructions, and no Fullwell scheduler state.
10. Update both normative product specifications plus architecture, security, reliability, and weekly-automation design docs before code consumers diverge.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npx vitest run apps/server/src/domain/journal-validation.test.ts`
- `npm run typecheck`
- `npm run verify:docs`

Exit evidence:

- runtime schemas reject invalid dates, slots, sources, revisions, URLs, and oversized content;
- type tests prevent unanswered constraints from masquerading as confirmed none;
- specs define local/cloud authority, search consent, multi-proposal behavior, safe wording, the login-free derived visual-board boundary, and the host-owned personal scheduling boundary.

### Milestone 2 - Cloud append-only mutation and rebuildable projection

Files:

- `apps/server/src/services/mutation-runner.ts`
- `apps/server/src/services/mutation-runner.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/git/git-repository.ts`
- `apps/server/src/git/git-repository.test.ts`
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/domain/repository-projection.test.ts`
- `apps/server/src/core/types.ts`
- `apps/server/src/core/ports.ts`
- `apps/server/src/adapters/memory.ts`
- `apps/server/src/adapters/memory.test.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/persistence/neon-operational-store.integration.test.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/workers/reconciliation-worker.ts`
- `apps/server/src/workers/reconciliation-worker.test.ts`

Tasks:

1. Add the narrow `append_to_current_head` conflict policy to `MutationRunner`. Require call sites to declare it explicitly; default and existing call sites remain strict.
2. Derive proposal and event IDs and Git paths from the durable request identity. Reject path collisions and any attempt to change immutable content.
3. Implement `hfj_get_meal_plan`, `hfj_review_meal_constraints`, `hfj_add_meal_proposal`, the selected profile mutation, and the explicit withdrawal mutation with typed service methods and MCP descriptions.
4. Recheck owner/editor membership and projection HEAD under the household transaction lock immediately before each append. Viewers cannot mutate; cross-household identifiers fail without enumeration.
5. Store request fingerprint on first receipt. Exact replay returns the same proposal, response, and commit. Changed input for the same user/tool/key returns `REVISION_CONFLICT`.
6. Extend the repository projector and `HouseholdProjection` with constraint profile, weeks, proposals, events, and active-state derivation. Update reconciliation projection equality so every new field participates in drift detection. Git remains authoritative; Neon state must rebuild from a snapshot.
7. Keep proposal and event files append-only in every repository adapter and import/recovery path. Only the meal-planning profile may be updated at its expected revision.
8. Prove recovery after failure before commit, after Git commit, and during projection update. Reconciliation finds the commit by request ID, detects drift in any meal-plan projection field, and completes without duplicating a proposal.
9. Add bounded telemetry using tool name, request ID, duration, and stable error code only. Do not log meal titles, URLs, constraints, notes, search terms, actor display names, or household names.
10. If Milestone 0 requires a migration, implement it under `migrations/` with up/down/up and rollback notes; otherwise document why the current JSONB projection is sufficient.

Verification:

- `npx vitest run apps/server/src/services/mutation-runner.test.ts apps/server/src/services/household-food-journal.test.ts apps/server/src/git/git-repository.test.ts apps/server/src/domain/repository-projection.test.ts`
- `npm run test:integration`
- `npm run test:security`
- `npm run test:load`
- `npm run container:postgres:verify`

Exit evidence:

- two authenticated editor principals add different recipes to the same slot and both remain visible;
- strict existing profile/item mutations still reject stale expected HEAD;
- exact retries create one Git commit and changed-key reuse conflicts;
- Git projection rebuild reproduces the same active week after Neon state is discarded;
- reconciliation completes a committed proposal without a duplicate.

### Milestone 3 - Local-only planning and shared Codex/Claude behavior

Files:

- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/skills/plan-household-meals/` (new directory)
- `packages/agent-client/skills/plan-household-meals/SKILL.md`
- `packages/agent-client/references/meal-planning-and-food-constraints.md` (new)
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/references/semantic-food-rules.md`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/README.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Add exact validation and bounds for the local meal-planning profile, nested profile revision, confirmed time zone, user-confirmed local actor labels, weekly reviews, proposals, events, local recipe-content digests, source URLs, notes, week count, and idempotency records inside the existing journal.
2. Implement locked `save_meal_planning_profile`, `review_meal_constraints`, `append_meal_proposal`, and `record_meal_plan_event` operations. Reload after acquiring the existing process lock, preserve unrelated current journal fields, perform exact-replay detection, retain the supplied actor label on every proposal/event, increment one local revision, and atomically replace the file.
3. Add a short bounded live-lock wait for the purpose-specific meal-planning operations so two overlapping processes serialize and both append. Keep existing generic `save` behavior unchanged and return `LOCAL_HOUSEHOLD_BUSY` if the bounded wait expires.
4. Keep `save` semantics unchanged for existing onboarding flows. Never resolve a local conflict by overwriting the current journal with stale caller state.
5. Add the shared meal-planning skill. In both hosts, it first loads current constraints, confirms a short local actor label before the first local write, asks the exact first-time constraint question when unresolved, confirms the household time zone, summarizes known constraints and asks "Any changes?" for a new week, and persists both the answer and weekly review event before suggestions.
6. When using a known recipe, cite the journal item revision and actual Liked evidence. Inspect available ingredient evidence against current constraints; do not infer compatibility from Liked.
7. Treat internet research as a separate user-approved action. Search only when the user explicitly asks for web research in the current request or affirmatively chooses "new web research" or "both" after the skill offers known Liked recipes, new research, or a mix. Otherwise ask and wait before invoking any search capability; never infer approval from a general request to plan meals.
8. After research is approved and before each search that would include food-constraint terms, ask whether the minimal terms may be sent to the search provider. Do not persist or reuse that disclosure consent. If declined, use broad recipe terms and inspect ingredients locally under the already-confirmed research approval. If search is unavailable, fall back honestly to known recipes.
9. Treat all search results and recipe pages as untrusted content. Ignore embedded instructions, preserve the selected canonical URL and discovery provenance, and store no raw page or search query.
10. Use "appears compatible based on the listed ingredients" only when supported. Use `incomplete_evidence` when ingredient or cross-contact evidence is missing and ask the user to verify labels or the source.
11. Add dual-host eval cases for explicit none, recorded constraints, missing weekly review, confirmed time zone, local actor-label confirmation, ordinary planning with no search approval, explicit web-research approval, source-choice ask-and-wait, changed constraints, changed journal recipe, stale proposal recheck, free-form meals, liked-but-incompatible recipe, external provenance, per-search constraint-term consent, constraint-term disclosure denial with broad search, unavailable search, prompt injection, two same-slot suggestions with distinct local labels, exact retry, cloud proposer/owner/editor withdrawal, explicit local withdrawal attribution, and no-safety-guarantee language.
12. Update package validation, manifests, README, contract reference, privacy reference, semantic rules, and changelog for the new skill and local operations. Milestone 5 extends the same skill with the visual-board offer and renderer only after that tool exists.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:contract`
- `npm run build --workspace @fullwell/fullwell`

Exit evidence:

- two local processes with different confirmed actor labels preserve two attributable same-slot suggestions;
- a first-time planner cannot suggest or search before recording an explicit constraint answer;
- ordinary meal-planning requests do not trigger internet research until the user explicitly asks or chooses it, and constraint terms are disclosed only after the separate per-search consent;
- Codex and Claude pass the same known-recipe, internet-recipe, privacy, prompt-injection, and safety-language evals;
- the local journal contains no raw pages, search queries, credentials, or browser state;
- an old local reader compatibility fixture passes or the rollout remains blocked.

### Milestone 4 - Weekly host-native planning automation

Files:

- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/tests/packaging/package.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/plan-household-meals/SKILL.md` (new)
- `packages/agent-client/references/weekly-meal-planning-automation.md` (new)
- `packages/agent-client/references/meal-planning-and-food-constraints.md` (new)
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `docs/design/weekly-meal-planning-automation.md` (new)

Tasks:

1. At the end of the current Fullwell setup or onboarding flow, after its primary setup succeeds, ask the host to inspect the native task list for the stable task name. If no schedule exists, offer: "I can check in each week to plan meals. Sunday at 9:00 AM in America/Los_Angeles is the default. Want that, a different day and time, or no reminder?" Substitute the confirmed IANA time zone. Decline or silence creates nothing and does not block setup completion.
2. Teach the shared skill to create or update the native scheduled task from the same chat only after explicit confirmation. For Codex, schedule the current chat when available and explicitly invoke `$plan-household-meals` in the task prompt. For Claude, use the documented Desktop local-task path when local journal access is required. Do not create a Fullwell scheduler adapter, file, database record, or MCP tool.
3. Before create or update, list native tasks and reconcile by the stable task name. Reuse one exact task, surface conflicting duplicates for repair, and never create another while host state is unknown. Report success only when the host confirms the resulting task and schedule.
4. Require an exact recurring weekday, clock time, and time zone before creation. Interpret an explicit "Sunday morning is fine" as Sunday at 9:00 AM, but ask for a time when a non-default part of day is vague. Echo the exact schedule and whether it is recurring before applying the host action.
5. Use only the documented host creation flow proven in Milestone 0. If the current surface cannot manage native tasks, provide the exact task instruction and schedule as an honest handoff. A timeout, task draft, or rendered confirmation UI is not success.
6. Use a fixed bounded scheduled instruction: "Start this week's Fullwell meal-planning check-in. Load current meal-planning state, confirm whether allergies or food sensitivities changed, and ask whether the user wants liked recipes, new web research, or both. Do not search, create proposals, change constraints, or render a board until the user answers." Include no household title, member identity, recipe, constraint, URL, search term, credential, or live journal content.
7. When a run starts, resolve the current Monday-start week in the confirmed IANA time zone and inspect current meal-planning state. A completed current-week constraint review or existing planning proposals changes the question to a concise status check instead of starting duplicate work. A second household member's independent reminder may still contact that member but must not duplicate shared writes.
8. Start with: "Ready to plan meals for the week of <date>? I can start with recipes you've liked, look for new ones, or mix both. Before I recommend anything, have the household's allergies or food sensitivities changed?" Wait for the answer, then reuse the existing constraint review, per-search disclosure consent, and proposal behavior. If the later visual-board capability is installed, the ordinary optional board offer also applies; scheduling does not depend on it.
9. Support "what is my meal-planning schedule?", permanent weekday/time changes, pause, resume, remove, "skip this week", and one-time deferral. If the scope is ambiguous, ask "Just this week, or every week?" before mutating. Echo the exact resulting cadence or one-time action and report only the host-confirmed result.
10. Preserve the same local wall-clock time through daylight-saving transitions. When the detected IANA time zone differs from the confirmed schedule zone, show both and require confirmation before rescheduling. For a documented skipped run, create no backlog; allow at most one catch-up prompt while the week remains useful and only when no prompt or weekly review exists.
11. Select host mode by capability and data boundary. A local-only Claude household requires a local Claude Code Desktop task with access to the Fullwell directory; a remote Cowork task is eligible only when it can use an authenticated Fullwell cloud capability without copying local journal content. Codex schedules the existing chat when that preserves the required project context; otherwise it uses a new task that explicitly invokes `$plan-household-meals`.
12. Add dual-host packaging tests and evals for default Sunday creation, arbitrary confirmed schedules, vague times, permanent versus one-week changes, exact retry, unknown create result, duplicate discovery, repair, pause/resume/delete, skipped runs, DST boundaries, time-zone changes, already-planned weeks, multiple cloud members, local-only data access, scheduled prompt privacy, no automatic search/write, and visual-board handoff.
13. Add no Fullwell server route, database table, worker, cron, calendar event, email, WhatsApp message, push notification, launchd job, or OS-level scheduler fallback. The client specification must say that uninstall/rollback cleanup is host-specific and that Fullwell does not guarantee a run while the selected host is unavailable.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:contract`
- `npm run test:security`
- `npm run build --workspace @fullwell/fullwell`
- `npm run verify:docs`

Exit evidence:

- clean Codex and Claude transcripts show one confirmed weekly task or an honest supported handoff, never duplicate or premature success;
- Sunday at 9:00 AM in the confirmed time zone is the offered default, while arbitrary exact weekday/time choices, pause, resume, removal, skip, and deferral work conversationally;
- spring-forward, fall-back, time-zone-change, sleep, missed-run, catch-up, and already-planned fixtures produce at most one useful check-in with no backlog storm;
- the scheduled instruction and native task name contain no household identity, recipe, constraint, search term, credential, URL, or prompt transcript;
- a scheduled turn asks and waits before any search, profile change, proposal write, or board creation;
- local-only and connected-cloud paths use only hosts that can reach their respective authorized data;
- rollback or uninstall evidence shows the native task paused or removed, or reports that host confirmation is still required without claiming cleanup.

### Milestone 5 - Login-free local visual recipe board

Files:

- `packages/agent-client/runtime/local-recipe-board.mjs` (new)
- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/tests/packaging/local-recipe-board.test.mjs` (new)
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/tests/packaging/package.test.mjs`
- `packages/agent-client/skills/plan-household-meals/SKILL.md` (new)
- `packages/agent-client/references/meal-planning-and-food-constraints.md` (new)
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `tests/e2e/local-recipe-board.spec.ts` (new)
- `docs/design/meal-planning-visual-board.md` (new)

Tasks:

1. Implement `fullwell_local_recipe_board_create` as a narrow tool that works whether or not a guest household exists. It accepts no path, HTML, CSS, or browser option, performs no network request, and writes only beneath the fixed private recipe-board directory.
2. Reuse or narrowly extract the existing local runtime's path-confinement, no-symlink, private-directory, atomic-write, fsync, lock, and stale-lock behavior. Do not maintain a second subtly different security implementation.
3. Derive the board directory from a stable idempotency key and store a bounded private manifest with the content fingerprint. Exact replay returns the same board; changed reuse returns a stable conflict; concurrent distinct keys create distinct boards.
4. Generate the HTML and CSS from constants plus escaped fields. Include a meta CSP that disables scripts, connections, objects, frames, media, forms, base changes, and all default sources; allow only owned inline style and HTTPS images. Include no inline event handlers, active SVG markup, third-party scripts, remote fonts, analytics, or service workers.
5. Render one semantic heading, a short local/private explanation, and a DOM-ordered list of at most 48 cards. Use responsive CSS Grid with one column at 320 pixels and increasing columns at wider viewports. Do not use CSS multi-column masonry because its visual order can diverge from reading and keyboard order.
6. Give each card fixed image dimensions, meaningful alt text, lazy loading, `referrerpolicy="no-referrer"`, anonymous cross-origin loading when supported, image-page provenance, an attractive non-image fallback, source label/link, why-recommended text, status badges, proposed slot, and a text-plus-icon compatibility state. Never include raw allergy/sensitivity labels by default.
7. Accept only HTTPS recipe and image URLs without credentials. Require image-page provenance for an image. Open source links in a new tab with `rel="noopener noreferrer"`; never turn a title or URL into markup. The privacy copy must explain that the image host can receive ordinary network metadata and may receive existing site state unless the verified anonymous mode prevents it. If a source requires credentials or does not support the reviewed anonymous image boundary, prefer the fallback rather than weakening privacy.
8. Create mode-0700 directories and mode-0600 files without following symlinks. Bound serialized HTML and manifest sizes. On each successful create, remove only generated boards older than the frozen retention or beyond the frozen count, never the current board or any journal data. Add no daemon, scheduled job, listener, or background cleanup.
9. Return the absolute path and encoded `file://` URL only after the final file is durable. The tool does not open the browser. The skill uses the verified Codex/Claude host action after explicit user intent and reports created/opened/fallback states separately.
10. Document and test the exact chat sequence:
    - default response: recommendation bullets;
    - offer: "Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required. Images load from their source sites.";
    - acceptance: create and attempt supported opening;
    - success: "I opened the private recipe board in your browser.";
    - created but not opened: show the local link/path and "If that link does not open here, say 'open the recipe board.'";
    - decline: make no file and continue normally.
11. Extend the shared skill and dual-host evals for offer, accept, decline, retry, no-image, unsafe-image, browser-open success, browser-open failure, connected-cloud source data, and no-login language.
12. Add malicious-input tests for HTML/script/style injection, `javascript:`, `data:`, `file:`, URL credentials, encoded traversal, symlink paths, huge text, too many cards, malformed Unicode, duplicate keys, changed retry, and cleanup confinement.
13. Add Playwright evidence for image/fallback cards, link behavior, CSP, keyboard order, focus visibility, screen-reader names, reduced motion, 200 percent zoom, desktop, 390x844, and 320x568. Use fixture HTTPS URLs and block live network; do not make deterministic tests depend on remote images.
14. Capture approved visual direction, card anatomy, density, responsive states, source attribution, compatibility language, image disclosure, empty/fallback states, and exact screenshots in `docs/design/meal-planning-visual-board.md`.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npx playwright test tests/e2e/local-recipe-board.spec.ts`
- `npm run test:accessibility`
- `npm run test:security`

Exit evidence:

- exact replay returns the same private file and changed reuse conflicts;
- malicious input cannot add active content, escape the private directory, or survive as markup;
- the renderer makes no network request and the browser board contains no remote script, font, style, tracker, form, or listener;
- Codex and Claude prove created, opened, fallback, and declined outcomes without claiming a browser action that did not happen;
- screenshots show an intentional image-forward grid plus no-image fallbacks at desktop, mobile, and 320 pixels;
- the board opens without a Fullwell account or browser session while outbound recipe sites remain clearly separate.

### Milestone 6 - Connected-household week view

Files:

- `apps/web/src/route.ts`
- `apps/web/src/types.ts`
- `apps/web/src/context.tsx`
- `apps/web/src/app.tsx`
- `apps/web/src/server.tsx`
- `apps/web/src/fixtures.ts`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/routes/household-meal-plan.tsx` (new)
- `apps/web/src/test/route.test.ts`
- `apps/web/src/test/app.test.tsx`
- `apps/server/src/http/web.ts`
- `apps/server/src/http/web.test.ts` (new)
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/server/src/main.ts`
- `tests/e2e/meal-planning.spec.ts` (new)
- `tests/e2e/accessibility.spec.ts`

Tasks:

1. Add `GET /households/:id/meal-plan?week=<monday-date>` with a server-owned view model grouping every active proposal by date and slot.
2. Add ordinary HTML POST baselines for simple proposal addition and explicit withdrawal. Require authenticated membership, CSRF, server-generated or validated idempotency, bounded input, and POST/redirect/GET behavior.
3. Render multiple proposal cards in one slot without hiding alternatives. Show proposer, free-form/known/external source, constraint-review state, compatibility caveat, and an explicit withdrawal action only for the proposer or an owner.
4. For a valid fresh week with no proposals, render a clear empty state that says no meals have been proposed yet, preserves all seven dates and slot structure, and presents the authorized add form without implying that planning failed.
5. Give stale proposals a non-color warning and a path to review current constraints. Do not expose private constraint text outside authenticated household views or include it in page titles, URLs, analytics, or client errors.
6. Keep internet research in Codex or Claude. The web UI may add a typed simple suggestion or display agent-added external references, but does not fetch recipe pages.
7. Make week navigation stable across DST and household time zones. Preserve focus after add/withdraw, announce the changed slot, and support keyboard, screen reader, reduced motion, no-JavaScript forms, 200 percent zoom, desktop, 390x844, and 320x568.
8. Add a two-browser-principal end-to-end race: both submit different Monday-lunch proposals from the same initial view; the refreshed page shows both.
9. Add authorization tests for owner, proposing editor, other editor, viewer, removed member, stale membership projection, CSRF failure, cross-tenant IDs, exact retry, and changed idempotency input. Confirm public collection serialization never includes meal-plan or constraint data.
10. Add component, SSR, no-JavaScript, and Playwright assertions for a valid empty week, including the empty message, date/slot semantics, authorized add control, viewer read-only state, and no horizontal overflow at 320 pixels.

Verification:

- `npx vitest run apps/server/src/http/web.test.ts apps/server/src/http/web-view-model.test.ts apps/web/src/test/route.test.ts`
- `npm run test:e2e`
- `npm run test:accessibility`

Exit evidence:

- desktop, mobile, 320-pixel, reduced-motion, keyboard, and no-JavaScript screenshots or assertions;
- a two-principal browser race showing both same-slot proposals;
- a fresh authorized week with no proposals renders the intentional empty state and usable add path;
- explicit, attributable withdrawal without deletion;
- no sensitive constraint content in URLs, public pages, logs, or browser error payloads.

### Milestone 7 - Release, deployment, and recovery evidence

Files:

- `apps/server/src/config.ts`
- `apps/server/src/config.test.ts`
- `deploy/deploy.env.example`
- `deploy/compose.yaml`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/legal/privacy.md`
- `docs/release/privacy-review.md`
- `docs/design/weekly-meal-planning-automation.md` (new)
- `docs/IMPLEMENTATION_LOG.md`
- `apps/web/src/routes/legal.tsx`
- `packages/agent-client/references/weekly-meal-planning-automation.md` (new)
- `packages/agent-client/CHANGELOG.md`
- `docs/exec-plans/completed/2026-07-23-collaborative-household-meal-planning.md`

Tasks:

1. Gate cloud writes and the authenticated route behind a typed capability flag that defaults off until the compatible server, projector, and client package are deployed. Keep local known-recipe planning independently releasable if Milestone 0 proved compatibility.
2. Run security tests for injection, unsafe URLs, cross-tenant access, constraint leakage, malformed repository files, proposal/event path collisions, oversized weeks, authorization races, local board path escape, active-content injection, CSP weakening, file permissions, cleanup overreach, sensitive scheduled instructions, and false host-success claims.
3. Run load tests for many proposals across households, same-household append contention, projection rebuild, week reads, exact retry fan-in, and reconciliation.
4. Run backup, readable export, Git bundle, restore, and repository-signature checks. Prove meal-planning Git data survives restore and Neon projections rebuild.
5. Install the packed agent package in clean Codex and Claude homes. Verify capability discovery, local-only planning, connected planning, known recipe selection, web-search fallback, cloud add/read behavior, weekly schedule offer/confirm/edit/pause/resume/delete/run, visual-board offer/decline/create/open/fallback, and login-free viewing using redacted fixture data.
6. Deploy to staging with writes disabled, rebuild projections, enable one internal household, exercise two real test principals, inspect redacted telemetry and resource use, then expand the flag.
7. Enable weekly schedule creation only after the deployed package can discover, pause, and remove a task created by the new version. Canary one task per supported host, inspect run history and redacted state, and verify that a setup rerun discovers rather than duplicates it.
8. Verify rollback by first disabling new schedule offers and pausing or deleting canary host tasks, then disabling cloud writes and the route while leaving append-only Git data intact. Roll back the application only after proving the old binary preserves and safely ignores the new paths. Never delete proposal history as rollback, and never remove schedule-management compatibility while an active task may remain.
9. Update normative docs, privacy disclosures, legal-page rendering, changelog, implementation log, and release evidence with exact commands and residual limitations. Disclose connected-household visibility, host-owned scheduling, local board files, direct recipe-image host contact, agent-host processing, and optional search-provider disclosure without overstating food safety.
10. Attempt `npm run capture:screencast -- --output artifacts/screencasts/collaborative-meal-planning.mp4`, `npm run capture:screencast -- --output artifacts/screencasts/weekly-meal-planning-automation.mp4`, and `npm run capture:screencast -- --output artifacts/screencasts/login-free-visual-recipe-board.mp4` against fixture-only household data. If the known macOS `x11grab` limitation recurs, record the exact failure and retain browser screenshots and interaction evidence without claiming an MP4.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:contract`
- `npm run test:integration`
- `npm run test:security`
- `npm run test:load`
- `npm run test:e2e`
- `npm run test:accessibility`
- `npm run test:restore`
- `npm run container:postgres:verify`
- `npm run verify`
- `npm run verify:ideas`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run test:deploy-smoke`
- `npm run test:mcp-smoke`

Exit evidence:

- fixture-only Codex and Claude host transcripts;
- weekly automation create/discover/edit/pause/resume/delete/run and orphan-free rollback transcripts for each supported host;
- local board path/CSP/privacy/accessibility reports and host open/fallback transcripts;
- staging two-principal race and retry evidence;
- projection rebuild, backup, restore, and rollback evidence;
- redacted desktop/mobile/narrow screenshots and a screencast attempt;
- complete verification output and a documented flag-expansion decision.

## Idempotence and Recovery

Cloud proposal and event mutations use the existing durable mutation identity `(user_id, tool, idempotency_key)` plus a fingerprint of all semantic input. The first receipt stores the request ID and fingerprint before acquiring the household lock. The server derives the proposal or event ID from that durable request identity, so a crash and retry cannot allocate a different path.

An `append_to_current_head` mutation does not accept a caller-selected expected HEAD. Under the household advisory lock it:

1. finds an existing commit by request ID;
2. if no commit exists, loads the current repository HEAD;
3. verifies current membership and projection alignment;
4. builds exactly one append-only change at the deterministic path;
5. commits against that current HEAD;
6. records `git_committed`;
7. applies the projection and advances membership heads;
8. records `projections_applied` and `completed`.

If another valid proposal committed first, step 2 sees the newer HEAD and appends to it. This is safe only for immutable unique paths. Profile writes, proposal-content edits, membership changes, and other mutable operations retain strict expected revisions.

If Git committed but the response or projection did not, reconciliation finds the request trailer, replays projection application, and returns the original proposal. A changed fingerprint never reuses that commit. A malformed authoritative meal-plan document causes `PROJECTION_DRIFT` and household quarantine rather than silent omission.

Local append and event operations acquire the existing lock before loading the document. They search the bounded local idempotency ledger, return the existing result on exact replay, reject changed reuse, append one record, increment revision, and use the existing atomic replacement path. Stale locks use the existing bounded recovery rules. Generic `save` keeps exact revision behavior.

Withdrawals are idempotent events. Repeating the same key returns the original event; a second distinct withdrawal event may be accepted as an auditable no-op only if the contract explicitly says so, otherwise it returns a stable already-withdrawn result. No recovery path deletes an immutable proposal.

Visual-board creation uses a separate local lock and a deterministic board directory derived from the stable idempotency key. The private manifest stores a bounded semantic-input fingerprint. While the board is retained, exact replay returns the same durable `index.html`; changed reuse conflicts; distinct concurrent keys create distinct directories. A crash before the atomic directory/file replacement leaves no success result and a retry completes safely. A crash after replacement returns the existing board on retry.

Generated-board cleanup is recoverable cache eviction, not journal deletion. It runs only after a new board is durable, targets only validated generated board IDs beneath the fixed private directory, never follows symlinks, and never removes the current board. After a board ages out, replay may deterministically recreate it at the same path from the same input; no permanent idempotency ledger is added for a disposable presentation artifact.

Weekly scheduling uses the host task list as its only idempotency and lifecycle authority. Before creation or retry, the skill lists native tasks by the stable Fullwell task name. One exact match is reused or updated, conflicting matches require repair, and no retry creates a second task while the host result is unknown. Pause, resume, reschedule, skip, and delete are reported only after the host confirms the resulting state.

A scheduled run computes the current Monday-start week in the confirmed IANA time zone and reads authoritative local or cloud meal-planning state before acting. Existing current-week review or proposal state changes the prompt to a concise status check rather than duplicating planning work. Missed intervals follow the selected host's documented behavior and do not cause Fullwell to synthesize a backlog. A one-week skip uses native host task behavior, not a recurring schedule rewrite.

## Rollout and Rollback

Use a capability flag for cloud meal-plan reads/writes and the authenticated route. The release order is:

1. ship readers, projector support, contracts, and disabled routes;
2. rebuild and verify projections with no write exposure;
3. ship the compatible agent package with automation discovery, repair, pause, resume, and delete support, but no schedule-creation offer;
4. prove host scheduling and cleanup on clean Codex and Claude installations, then enable the weekly offer for one internal user;
5. ship the visual-board capability disabled until clean host checks pass;
6. enable the local visual-board offer independently because it has no cloud schema or server dependency;
7. enable one internal cloud household;
8. prove two-principal append, retry, restore, schedule cleanup, and rollback;
9. expand gradually.

Local-only known-recipe planning may ship independently only if the outer-schema-v1 and package rollback fixtures prove that older package versions preserve the new inner journal data. Internet-search behavior can remain unavailable on a host without blocking known recipes.

The visual board may ship independently with the agent package after private-file, injection, remote-image disclosure, accessibility, and host-opening gates pass. Rolling it back removes the offer and local tool registration; existing generated boards remain inert static files and age out on a future compatible create or may be deleted explicitly. Rollback does not touch the journal or cloud repository.

The weekly automation may ship independently only on hosts that pass the installed capability matrix. Rollback first disables new offers, then uses the host's native task list to pause or delete every canary task before removing create guidance. If cleanup cannot be confirmed, retain management guidance and report the specific host action still required; do not claim the task was removed.

Rollback first disables new writes and hides the route and skill capability. Append-only Git documents remain authoritative and must not be deleted. The old server binary may be restored only if Milestone 0 proves it preserves unknown paths and keeps authorization/projection behavior safe; otherwise roll forward with the compatible reader instead. Any migration must have tested down/up behavior, but a database rollback must never discard the only copy of a proposal.

The feature cannot move from canary if telemetry shows projection drift, idempotency conflicts on exact replay, duplicate proposal paths, local lost updates, constraint leakage, or a stale-profile proposal presented as current.

## Acceptance / Verification

User-visible acceptance:

- After the current Fullwell setup or onboarding flow succeeds, it offers one weekly planning check-in if none exists. Declining or ignoring the offer leaves setup complete and creates no task.
- The offered default is Sunday at 9:00 AM in the confirmed IANA time zone. The exact recurring weekday, clock time, and time zone are shown before creation; an arbitrary user-specified day and time replaces the default.
- A successful creation message is backed by the host's task result. An unsupported nested-automation path uses a supported prefilled confirmation handoff, and an uncertain result says it needs repair rather than claiming success.
- The user can ask for the current schedule, make a permanent day/time change, pause, resume, remove, skip one week, or defer one occurrence. "Move it to Tuesday" prompts "Just this week, or every week?" when scope is not otherwise clear.
- The schedule preserves local wall-clock time through DST. A time-zone change is shown and confirmed; a slept-through or skipped run creates no backlog and at most one useful catch-up.
- When the task fires, it asks whether the user wants to plan, whether household constraints changed, and whether to use Liked recipes, new research, or both. It performs no search, constraint mutation, proposal write, or board creation until the user answers.
- One personal task and prompt exists per user and host installation per week. Multiple cloud members may have separate reminders, but no member can change another's and no personal schedule is stored in shared household state.
- The fixed scheduled instruction and native task name contain no household title, member identity, recipe, constraint, search term, URL, credential, prompt transcript, or public identifier.
- A fresh local user is asked about allergies and food sensitivities before the first meal suggestion or internet search. An explicit "none" is stored distinctly from unanswered.
- A first saved week requires a user-confirmed household IANA time zone; a detected host time zone is only a suggested default.
- A returning planner sees the recorded constraint summary and is asked whether anything changed for the new week, without repeating the entire onboarding exchange. A weekly review event proves the question was answered against the current profile revision.
- A Liked recipe can be proposed with its item revision and actual Liked evidence, but is not described as compatible until its available ingredients are reviewed against current constraints.
- A free-form suggestion such as pizza can be added without a journal item or URL and remains visibly unverified when ingredient evidence is incomplete.
- An external recipe proposal displays its HTTPS source and discovery provenance and has no implicit Saved, Cooked, or Liked state.
- Recommendation chat always retains concise text bullets. When visual cards would add value, it offers: "Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required. Images load from their source sites."
- Declining or ignoring the visual offer creates no file and opens no browser. An explicit "show me visually" or affirmative answer creates the board.
- A local-only user and a connected-cloud user can open the same kind of private local board without a Fullwell browser login. Board creation does not initialize a guest household or publish cloud data.
- Weekly meal plans and ordinary ad hoc prompts such as "What should I make tonight?" can use the same board; the optional context label does not require a saved week.
- A successful open is reported as opened. If only file creation succeeded, the response provides the local link/path and says, "If that link does not open here, say 'open the recipe board.'" It never conflates those states.
- The board shows at most 48 image-forward cards with source, recommendation reason, statuses, proposed slot, and compatibility caveat. Missing or blocked images get a designed fallback rather than an unrelated image.
- Board files omit allergy and sensitivity labels by default, use private permissions, contain no scripts/forms/trackers/remote styles or fonts, and load only provenance-bearing HTTPS images after the source-site disclosure.
- No card depends on signing in to an image host. Credential-dependent or blocked images render the designed fallback; outbound recipe pages may have their own unrelated access rules.
- Malicious titles, reasons, image URLs, and recipe URLs cannot create markup, active content, unsafe navigation, local file access, or a path outside Fullwell's private generated-board directory.
- The board's DOM order matches its visual and keyboard order, and it works with keyboard, screen-reader names, reduced motion, 200 percent zoom, desktop, 390x844, and 320x568.
- If Codex or Claude cannot search, it says so and continues with known recipes or asks the user for a source. It never invents a live result.
- Search does not include allergy or sensitivity terms until the user authorizes that disclosure for that search. Consent is not retained for a later search. Declining still permits broad search plus local ingredient inspection.
- Two users adding egg salad and pizza to Monday lunch from the same initial cloud HEAD see both after refresh. Neither independent append returns `REVISION_CONFLICT`.
- Two local processes appending with different confirmed actor labels preserve both proposals and their attribution. Local actor labels are not presented as authenticated identities.
- An exact retry produces one proposal and one commit or local revision. Reusing the key for changed input conflicts.
- A viewer, removed member, wrong-household actor, or principal without `journal:write` cannot add or withdraw and learns no cross-household details.
- Changing the constraint profile or cited journal recipe does not erase proposals; proposals tied to the old profile revision or recipe digest display `needs_recheck`. Unrelated local journal writes do not invalidate the review.
- Recipe-page instructions are ignored, incomplete ingredients remain visibly unverified, and no output promises allergen safety.
- Withdrawal is explicit and attributed. In cloud mode a proposer can withdraw their own idea and an owner can withdraw any idea; an editor cannot withdraw another person's idea. In local-only mode any local operator may withdraw, and the event records the current confirmed local actor label without claiming authentication. The proposal remains in Git or local history and disappears only from the active slot view.
- Logs, metrics, errors, URLs, and public pages contain no constraints, meal names, recipe URLs, notes, actor names, household names, or search terms.
- Public collection snapshots never contain meal plans or meal-planning constraints. The shared-constraint prompt explains connected-household visibility and asks users not to include names or medical narratives.
- The web week works with keyboard, screen reader semantics, reduced motion, no JavaScript, 200 percent zoom, and 320 CSS pixels.
- Backup/export contains the meal plan, Git restore succeeds, and Neon projection rebuild reproduces the active week.

Required commands:

- `npm run test --workspace @hfj/contracts`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:contract`
- `npm run test:integration`
- `npm run test:security`
- `npm run test:load`
- `npm run test:e2e`
- `npm run test:accessibility`
- `npm run test:restore`
- `npm run container:postgres:verify`
- `npm run verify`
- `npm run verify:ideas`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run test:deploy-smoke`
- `npm run test:mcp-smoke`
- `npm run capture:screencast -- --output artifacts/screencasts/collaborative-meal-planning.mp4`
- `npm run capture:screencast -- --output artifacts/screencasts/weekly-meal-planning-automation.mp4`
- `npm run capture:screencast -- --output artifacts/screencasts/login-free-visual-recipe-board.mp4`

Manual and staged evidence:

- current Codex and Claude capability matrix and clean-install transcripts;
- weekly automation default/custom create, confirmation fallback, edit, pause, resume, skip, delete, scheduled-run, missed-run, repair, and rollback transcripts from both hosts;
- visual-board create/open/fallback/decline transcripts from both hosts;
- private-path, file-mode, CSP, escaping, remote-image, cleanup, and no-network-renderer evidence;
- privacy and food-safety copy review;
- two-principal same-slot race at service and browser boundaries;
- local two-process race;
- current and changed constraint-revision screenshots;
- old-reader, old-server, rollback, backup, restore, and projection-rebuild evidence;
- fixture-only desktop, mobile, and 320-pixel screenshots;
- redacted screencast, or the exact known host capture failure with browser evidence retained.

## Artifacts and Notes

Store only redacted, fixture-only visual evidence under `artifacts/`. Never capture live household constraint text, member names, private recipe history, search queries, OAuth data, real household identifiers, host task identifiers, live task names, or a live local board path. Screenshot and screencast fixtures use invented recipes, synthetic task confirmations, and local network-blocked images.

During implementation, update `docs/IMPLEMENTATION_LOG.md` after each milestone and append dated discoveries and decisions to this plan. User-visible behavior changes require synchronized client and server product-spec edits. Boundary changes require `docs/ARCHITECTURE.md`; privacy, search, health-adjacent data, or log changes require `docs/SECURITY.md`; concurrency, recovery, compatibility, and rollback changes require `docs/RELIABILITY.md`.

Do not create a new search-provider or scheduler adapter merely to make tests deterministic. Use fixture host outputs, fixture schedule results, and fixture pages. Do not add a local HTTP listener or image proxy for the board. Do not add server cron or an OS scheduler fallback. Do not create a database migration unless Milestone 0 proves the existing rebuildable projection shape cannot support the feature.

## Critique Gate

The feature critic restated the intent as: build a local and cloud weekly proposal ledger that grounds known favorites in journal evidence, optionally uses agent-led internet research, confirms household food constraints before recommendations, and makes concurrent additions accumulate.

Selected critics:

- Privacy and food-safety critic, because constraints are health-adjacent shared data and recipe evidence can be incomplete.
- Distributed-consistency critic, because the core promise depends on same-slot writes commuting without weakening other conflicts.
- Household UX and accessibility critic, because a useful week must accept ordinary free-form ideas, explain multiple cards, and remain usable on narrow screens.
- Applied-ML and prompt-injection critic, because Codex or Claude interprets preference, constraints, ingredients, and untrusted search pages.
- Release and recovery critic, because new local state and Git paths must survive older readers, rollback, restore, and projection rebuild.

Must fix before implementation:

- A profile revision alone did not prove the household was asked for the current week. The plan now requires an immutable weekly constraint-review event and makes each proposal cite it.
- The first draft supported only journal or external recipes, which excluded ordinary suggestions such as "pizza." The source union now includes a bounded free-form meal.
- The time-zone authority was implicit. The plan now requires user confirmation before the first saved week.
- Search consent could have been interpreted as persistent. The plan now makes it single-search and non-persistent.
- A constraint-only staleness rule missed changed recipe ingredients. The plan now marks a proposal stale when either its constraint profile or cited journal recipe revision changes.
- Withdrawal authorization was unresolved. The plan now permits the proposer or a household owner, not an unrelated editor.
- Shared health-adjacent data needed a firmer boundary. The plan now excludes it from public collections, asks for no names or medical narratives, and adds log/public-projection tests.

Should fix if low-cost:

- Add a simple explicit selection event only if user research shows that highlighting a chosen option is necessary for version 1; do not make it a prerequisite for preserving proposals.
- Prefer bounded structured constraint labels over long Markdown so users can review and remove individual entries without inviting medical narratives.

Monitor during implementation:

- Host internet-search capability drift and permission UX across Codex and Claude versions.
- Growth of append-only weeks and events in projector memory and household exports.
- Confusion between `incomplete_evidence` and a negative compatibility judgment.
- Same-household lock duration and idempotency fan-in under bursty collaborative use.

### Weekly-automation extension critique

The extension intent is: let the current Fullwell setup or onboarding automation offer one personal weekly host task that asks the user to plan, defaults to Sunday morning, and remains conversationally manageable without turning Fullwell into a scheduler or silently planning meals.

Selected critics and required changes:

- Host-platform critic - fragile assumption: "an automation can launch another automation." Missing risk: Codex publicly documents scheduled thread wake-ups but not a universal nested-creation API, and Claude scheduling surfaces have different session and local-data semantics. Required change applied: Milestone 0 proves the installed create/discover/manage path; otherwise the initiating flow presents a supported prefilled confirmation handoff and does not claim success.
- Habit and household UX critic - fragile assumption: "Sunday morning" is sufficiently precise. Missing risk: vague times, unwanted recurring changes, and nagging after a week is already planned. Required change applied: offer Sunday at 9:00 AM in the confirmed IANA zone, echo exact cadence, distinguish one-week from permanent changes, support skip/pause/delete, and deduplicate against current-week state.
- Privacy and authorization critic - fragile assumption: "a helpful scheduled prompt can contain the planning context." Missing risk: host task listings, logs, or remote runners could expose household names, health-adjacent constraints, recipes, or searches. Required change applied: use a fixed non-sensitive instruction, per-user host ownership, and no Fullwell-local, Git, Neon, public, or server-scheduler state.
- Time and reliability critic - fragile assumption: "weekly" fires exactly once at the intended local time. Missing risk: DST, time-zone travel, jitter, sleeping devices, skipped runs, duplicate tasks, uncertain creation results, and orphaned tasks after rollback. Required change applied: IANA wall-clock semantics, confirmation on zone changes, host-list reconciliation, honest host availability semantics, and cleanup before removing management guidance.
- Food-safety and applied-ML critic - fragile assumption: "start planning" authorizes recommendations. Missing risk: the task could search or recommend against stale constraints before the user answers. Required change applied: the scheduled turn asks whether constraints changed and which recipe source to use, then waits; all existing per-search consent, evidence, and safety-language rules still apply.

Must fix before implementation:

- Prove exact Codex and Claude task creation, discovery, management, data-access, sleep, and missed-run behavior on clean supported installations.
- Approve the setup offer, exact schedule confirmation, scheduled check-in, ambiguity, success, repair, and host-unavailable copy.
- Prove exact retry and setup rerun produce one host task, not two.
- Prove an active task can be paused or removed before package rollback or uninstall.
- Prove a scheduled run performs no search or mutation before the user answers.

Should fix if low-cost:

- Offer a user-selected default planning household only if multi-household research shows repeated selection is burdensome; do not put its title or identifier in the scheduled prompt.
- Show the host's documented availability limitation next to the schedule when a local task requires the app and device to remain awake.

Monitor during implementation:

- Codex and Claude scheduler capability and UI changes.
- Host jitter, skipped-run, and notification behavior that could make "Sunday at 9:00 AM" misleading.
- Duplicate or orphan-task repair frequency.
- Whether users confuse a personal reminder with the shared household plan.

### Visual-board extension critique

The extension intent is: preserve the normal recommendation bullets, then let a local-only or connected user explicitly open the same recommendations as a private image-forward browser board without a Fullwell login, public link, or persistent web service.

Selected critics and required changes:

- Local security critic - fragile assumption: "a local HTML file is automatically safe." Missing risk: injected markup, unsafe URL schemes, path traversal, symlink escape, permissive active content, or cleanup outside the generated directory. Required change applied: one deterministic renderer owns all markup and paths, uses exact schemas, escaping, HTTPS-only URLs, private modes, no-symlink traversal, atomic writes, restrictive CSP, malicious-input tests, and bounded cleanup.
- Privacy critic - fragile assumption: "not using Fullwell cloud means images are private." Missing risk: an image request can disclose IP address, user agent, and possibly existing site state to the image host. Required change applied: the offer states that images load from source sites, every image has page provenance and no-referrer behavior, the renderer never fetches or proxies, credential-dependent images fall back, and privacy/legal review covers direct image-host contact.
- Host-integration UX critic - fragile assumption: "a `file://` link opens everywhere." Missing risk: Codex and Claude surfaces can block local links or distinguish file creation from browser opening. Required change applied: Milestone 0 builds a host matrix, the renderer returns path and URL but never opens, the skill uses only supported permission-visible open actions after explicit intent, and copy reports created/opened/fallback states accurately.
- Accessibility critic - fragile assumption: "Pinterest-style masonry is only visual styling." Missing risk: CSS multi-column layouts can make visual and reading order diverge, while image-only cards hide source and safety status. Required change applied: use DOM-ordered CSS Grid, semantic list/card structure, meaningful alt/fallbacks, text-plus-icon states, keyboard/focus checks, reduced motion, zoom, and 320-pixel evidence.
- Reliability critic - fragile assumption: "generated files need no lifecycle." Missing risk: concurrent chats overwrite one board, retries duplicate it, partial writes appear successful, and snapshots grow without bound. Required change applied: stable per-request IDs, a separate lock, atomic durability, retained-manifest fingerprints, distinct board directories, count/age/byte bounds, cleanup only after success, and no background listener or daemon.

Must fix before implementation:

- Prove file-link and browser-open behavior on clean current Codex and Claude installations.
- Freeze the remote-image credential behavior; any image that cannot load within the reviewed privacy boundary must use a fallback.
- Prove the generated document cannot execute caller-controlled content or escape its fixed private directory.
- Approve the exact offer, disclosure, success, fallback, and decline copy.
- Preserve DOM order and verify the board with keyboard, screen-reader, narrow, zoom, and network-blocked fixtures.

Should fix if low-cost:

- Offer a text-only visual retry if a household prefers not to contact remote image hosts.
- Add an explicit "remove generated recipe boards" local maintenance action only if bounded create-time eviction is insufficient; do not broaden journal deletion.

Monitor during implementation:

- Recipe image hosts that reject anonymous or hotlinked requests and the resulting fallback rate.
- Host changes to local-file link rendering or browser-open permission labels.
- Generated-board disk use and cleanup duration.
- Whether users mistake an outbound recipe-site login or paywall for a Fullwell login requirement.

## Documentation Drift Review

Required implementation-time updates:

- `docs/product-specs/household-food-journal-client.md` for the shared skill, native host scheduling handoff, schedule offer/manage/check-in copy, visual-board tool, exact offer/open/fallback behavior, local file authority, constraint question, search/image disclosures, provenance, capability fallback, and cross-host eval behavior.
- `docs/product-specs/household-food-journal-server.md` for repository layout, tools, profile visibility, roles, append conflicts, authenticated web routes, projections, exports, acceptance, the explicit statement that the login-free board is a local derived artifact outside server authority, and the explicit absence of a Fullwell server scheduler or shared reminder state.
- `docs/ARCHITECTURE.md` for the proposal/event authority, additive mutation policy, host-search boundary, host-only scheduling boundary, local nested revisions, private generated-board boundary, and public-projection exclusion.
- `docs/SECURITY.md` for health-adjacent constraint data, non-sensitive scheduled instructions, absence of Fullwell schedule state, per-search disclosure, direct image-host contact, prompt injection, generated HTML/CSP/path safety, URL handling, field redaction, authorization, and public collection boundaries.
- `docs/RELIABILITY.md` for local and cloud races, scheduler capability drift, task idempotency, DST/time-zone/missed-run behavior, repair and orphan-free rollback, board durability/cleanup/open fallback, projection rebuild, compatibility, bounds, and reconciliation.
- `docs/legal/privacy.md`, `docs/release/privacy-review.md`, and `apps/web/src/routes/legal.tsx` for accurate host-owned scheduling, local board storage, direct image-host requests, household, agent-host, and optional search-provider processing disclosures.
- `docs/design/weekly-meal-planning-automation.md` for the approved opt-in, exact schedule, host capability, scheduled prompt, management, availability, repair, and rollback experience.
- `docs/design/meal-planning-visual-board.md` for the approved image-forward direction, card anatomy, source/safety language, responsive states, and fallback evidence.
- `packages/agent-client/README.md`, `packages/agent-client/CHANGELOG.md`, and `docs/IMPLEMENTATION_LOG.md` for discoverability, release history, and exact evidence.

Optional improvements:

- Add the private visual-board branch to the architecture overview diagram when implementation establishes the final local tool and host-open boundary.
- Add a focused operator runbook only if canary rollback, projection quarantine, or constraint-data support procedures differ materially from current recovery guidance.
- Update `docs/QUALITY_LEDGER.md` only if implementation evidence changes a scored quality claim or introduces accepted debt.
- Promote a reusable repository skill only if the append-only collaborative-slot workflow repeats in another feature.

Missing verification evidence until implementation:

- current Codex and Claude internet-search capability and permission matrix;
- current Codex and Claude schedule create/discover/edit/pause/resume/delete, nested-automation, local-data, DST, sleep, missed-run, and rollback capability matrix;
- weekly automation exact-retry, repair, prompt-privacy, ask-before-action, and orphan-cleanup results;
- current Codex and Claude local-file link and browser-open capability matrix;
- visual-board private-path, injection, CSP, image privacy, retry, cleanup, accessibility, and screenshot results;
- privacy and food-safety copy review;
- local two-process and cloud two-principal same-slot race results;
- strict-conflict regression, idempotency fan-in, failure injection, reconciliation, and projection-rebuild results;
- old local reader, old server binary, backup, restore, migration if any, and rollback evidence;
- cross-host package/eval, browser accessibility, security, load, staging, and screencast-attempt evidence.

## Outcomes & Retrospective

Planning outcome as of 2026-07-23: the feature is framed as an append-only proposal ledger rendered as a week, with local and cloud implementations sharing one semantic contract. Known recipe preference comes from cited journal evidence; external research stays an explicitly authorized agent capability; food constraints are explicit, revision-bound, private household data; concurrent same-slot suggestions accumulate; a personal host-owned weekly task can ask the user to begin planning without acting silently; and an explicitly requested static local board can supplement chat with image-forward cards without a Fullwell login or new content authority.

Implementation outcome as of 2026-07-24: the agreed local and connected feature is implemented. The Git-authoritative cloud model and revisioned local model preserve concurrent same-slot proposals, explicit withdrawals, confirmed constraint reviews, cited Liked recipes, free-form suggestions, and externally researched recipe provenance without making an allergy-safety claim. The shared Codex/Claude skill asks before research or mutation, offers one host-native Sunday 9:00 AM check-in in the confirmed IANA time zone, and supports conversational discovery, repair, rescheduling, pause, resume, skip, and removal. The private static recipe board supplements chat and opens through a real `file://` WebKit path without a Fullwell login or local web server. The connected seven-day React/no-JavaScript view enforces membership, role, CSRF, tenant, idempotency, and append-only concurrency boundaries.

Release evidence is local and fixture-only. `npm run verify` passed lint, typecheck, production builds, 324 application tests, idea/docs/ExecPlan validation, and 11 expected database-gated skips. `npm run container:postgres:verify` passed all 11 skipped integration tests against PostgreSQL plus migration up/down/up for seven migrations. The focused contract, packaging, host-scheduling, security, load, restore, WebKit, accessibility, deployment-smoke, and MCP-smoke gates also passed, including exact-capacity coverage for 500 proposals, separate 500-event review and withdrawal reserves, complete event reads across proposal pagination, concurrent final withdrawals, and exact replay at capacity in local and cloud modes. `npm audit --omit=dev` reports zero vulnerabilities after the patched `find-my-way` lockfile update. The three required screencast commands were attempted, but Homebrew FFmpeg 8.0.1 lacks the helper's Linux-only `x11grab` input and returned exit code 234 each time; browser assertions are retained and no MP4 is claimed.

Post-completion rollout decision on 2026-07-24: because no users exist, connected meal-planning tools, routes, mutations, and navigation are unconditionally available and the unused rollout flag was removed from application and deployment configuration. No package was published, no personal native task was created, no commit was made, and no staging or production deployment was performed in this implementation session. Append-only readers, restore/rebuild coverage, and older local-data preservation fixtures continue to protect the data contract.

The documentation-drift review found every required behavior, architecture, security, reliability, privacy, rendered legal page, design, package, changelog, deployment-config, and implementation-log surface updated. Knowledge refresh updated the `docs/QUALITY_LEDGER.md` timestamp without changing a scored quality claim. Remaining release evidence is explicitly external: clean installed live-host task ceremonies, a canary task cleanup, a staging rollback, and live telemetry inspection. These are rollout activities, not hidden implementation gaps.

The final fresh adversarial review passed without blockers after verifying that review churn cannot consume withdrawal capacity, default proposal pagination still returns all 1,000 bounded events, exact retries remain available at capacity, and cloud/local checks run inside their authoritative serialization boundaries. Residual risks are bounded and documented: exact proposal/review limit fixtures are seeded while concurrency coverage concentrates on the final withdrawal reserve, and an externally corrupted over-limit Git week rebuilds before the locked read boundary rejects it as projection drift rather than being quarantined during rebuild.
