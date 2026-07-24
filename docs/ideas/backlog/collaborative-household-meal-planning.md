# Collaborative household meal planning

## Snapshot

- Status: `promoted`
- Priority lane: `next`
- Impact: `high`
- Confidence: `high`
- Effort: `large`
- Last reviewed: `2026-07-23`

## Why this matters

A household needs one place to coordinate a week of meals without treating a time slot as a single value that the latest person can overwrite. If one person proposes an egg salad sandwich for Monday lunch while another proposes pizza, both ideas should remain visible until someone explicitly withdraws one. This is collaborative suggestion gathering first and schedule finalization second.

Fullwell already remembers recipes the household saved, cooked, and liked. Weekly planning should use that evidence instead of making people reconstruct favorites from memory. It should also let Codex or Claude find new recipes through an explicitly authorized internet search, while keeping external pages untrusted and preserving where each suggestion came from.

Weekly planning is also a habit problem. The current Fullwell setup or onboarding automation should offer to create one host-native weekly planning check-in, defaulting to Sunday at 9:00 AM in the user's confirmed IANA time zone. The check-in should start a conversation, not silently choose meals, search the web, or write proposals. The user can change the recurring day or time, pause it, resume it, skip one week, or remove it in ordinary language.

Chat bullets are useful for deciding quickly, but recipe choice is unusually visual. The same recommendations should be available as an image-forward card grid in the user's browser without requiring a Fullwell account, cloud sign-in, or a public share. The agent should offer this as a lightweight supplement, for example: "Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required."

Meal suggestions can create a serious food-safety risk if the assistant has never asked who is eating and whether allergies or food sensitivities apply. Fullwell should ask explicitly before suggesting meals or searching, retain the confirmed constraints privately, and bind suggestions to the exact constraint revision that was checked. It must never promise that a recipe is "allergy-safe."

## Current evidence

- The user explicitly requested weekly household meal planning and clarified that two suggestions for the same day and meal slot must both be added rather than one overwriting the other.
- The user explicitly requested a weekly automation launched from the current setup or automation flow, with Sunday morning as the default and conversational day changes.
- The user requires the feature to work in both the local-only guest household and a connected cloud household.
- The user explicitly requested a Pinterest-style browser grid of possible or recommended recipes with images, in addition to chat bullets, without logging in to Fullwell or another board service.
- The existing recipe journal keeps Saved, Cooked, and Liked independent and can cite the evidence that supports each state.
- Codex and Claude already own recipe identity and other semantic food decisions; deterministic application code must not infer preference, equivalence, or safety.
- The local-only household is a bounded, revisioned JSON document under the active Codex home. It already uses a cross-process lock and atomic replacement, but its generic save operation rejects stale full-document revisions.
- The cloud service serializes household Git mutations under a PostgreSQL advisory lock. Existing mutable mutations reject a stale expected Git HEAD, which is correct for edits but would unnecessarily conflict two independent proposal additions.
- Git is authoritative for cloud household content, Neon holds rebuildable projections and durable mutation state, and the server is the sole Git writer.
- The server intentionally contains no LLM and has no server-side recipe-search provider. Codex or Claude can perform an authorized internet search through current host capabilities and return a bounded, provenance-bearing recipe reference.
- Existing recipe records already support an image URL plus audited-page provenance, and the server specification already requires external HTTPS images, no-referrer loading, lazy loading, dimensions, alt text, and a visible fallback without server-side image fetching.
- No current household profile records allergy or food-sensitivity answers, and no planning workflow verifies those constraints before recipe discovery.
- Current official host documentation establishes durable scheduling surfaces but not one uniform contract: Codex documents scheduled thread wake-ups; Claude Code Desktop documents weekly local tasks that can be created, listed, edited, paused, and resumed conversationally; Claude Cowork scheduled tasks run as separate sessions. A feasibility gate must prove the exact supported creation path instead of assuming one automation can silently create another.

## Expert panel

- Household product and UX expert - keeps planning collaborative, makes multi-proposal slots and the optional visual-board handoff understandable, and minimizes repeated safety questions.
- Habit and host-automation product expert - keeps the weekly invitation useful without becoming a nag, distinguishes one-week deferral from a recurring change, and requires exact schedule confirmation.
- Distributed systems and Git architect - preserves concurrent additions, idempotent retries, repository rebuilds, and strict conflicts for noncommutative edits.
- Privacy and food-safety specialist - handles health-sensitive household constraints, search-provider disclosure, ingredient uncertainty, and safe wording.
- Applied ML and evals specialist - grounds favorites in Liked evidence and tests internet provenance, incomplete ingredients, and prompt injection.
- Reliability and accessibility engineer - covers local process races, cloud principal races, private board files, browser opening, time zones, responsive visual cards, recovery, and rollout.

## What problem are we actually solving?

Help a household reliably begin, gather, and review meal ideas for a specific week, from known favorites or optional new-recipe research, without losing another person's suggestion or recommending food before the assistant has confirmed the household's relevant dietary constraints. Let the current Fullwell flow offer a private weekly planning check-in and let the household switch from concise chat bullets to a visual recipe board without creating an account or publishing the recommendations.

## Roundtable highlights

- Product and UX: model each meal slot as a set of proposal cards, not one editable recipe field. Adding another card is ordinary; withdrawing one is explicit and leaves history.
- Habit and automation UX: the recurring task should ask whether the user is ready to plan, then wait. Default to Sunday at 9:00 AM only after showing the exact local time and time zone; distinguish "this week" from "every week" when a requested change is ambiguous.
- Product and UX: keep chat bullets as the default answer, then offer a private visual board when recommendations would benefit from images. An explicit "show me" or "open it" authorizes local creation and browser opening.
- Distributed systems: give every proposal a unique immutable document. Under the existing household lock, append it to the latest Git HEAD and rely on durable idempotency so two independent additions commute.
- Privacy and food safety: ask about allergies and sensitivities before any planning. Explain that cloud household members can see the shared constraints, and ask separately before placing constraint terms into an external search query.
- Applied ML and evals: Liked is strong preference evidence but not allergen evidence. External search results stay external references and never silently become Saved, Cooked, or Liked.
- Reliability and accessibility: generate a bounded static HTML snapshot with a DOM-ordered responsive grid rather than CSS columns that scramble reading order. Use private file permissions, atomic creation, deterministic cleanup, image fallbacks, and a host-specific open-or-link fallback.

## Key tensions

- Helpful memory versus food safety: a liked recipe is a good candidate, but a prior Like does not prove its ingredients or current formulation satisfy today's constraints.
- Shared planning versus sensitive data: allergies and sensitivities need household visibility to coordinate meals, but should not leak through logs, public collections, raw search terms, or unrelated exports.
- Concurrent additions versus familiar revision conflicts: independent proposals should accumulate, while profile edits and other noncommutative changes must keep strict expected-revision checks.
- Broad recipe discovery versus private searches: including detailed health constraints can improve results but discloses information to the search provider.
- Local simplicity versus multiple conversations: local-only mode has no server lock, so the purpose-specific append operation must reuse the file lock and be idempotent instead of rewriting a stale journal snapshot.
- Agent judgment versus application invariants: Codex or Claude may assess ingredient compatibility, but typed boundaries must still enforce source, provenance, size, authorization, and revision contracts.
- Visual richness versus local privacy: direct image loading contacts the recipe site's image host, while downloading or proxying images creates SSRF, copyright, storage, and cleanup risks.
- One-click opening versus cross-host behavior: a `file://` link may be clickable in one Codex or Claude surface and blocked in another, so the workflow needs a supported browser-open action and an honest path fallback.
- Helpful prompting versus silent autonomy: a scheduled turn can reduce the burden of remembering, but it must not perform recipe research, disclose constraint terms, or mutate a plan before the user responds.
- Host convenience versus Fullwell authority: Codex or Claude owns the task, task list, and lifecycle state. Fullwell supplies the planning skill and conversational safeguards but stores no schedule receipt. Neither Git nor Neon should become a scheduler.

## Proposed direction

Add a weekly household meal-planning workflow with the following shape:

1. Represent a week as a Monday-start date interpreted in a household IANA time zone that the user confirms before the first saved week. A detected host time zone may be offered as a default but is not silently authoritative.
2. Represent breakfast, lunch, dinner, snack, and bounded custom meal labels as slots. Each slot contains zero or more active proposals.
3. Store each proposal as an immutable record with a server- or runtime-generated identifier, date, slot, proposing actor, source, bounded notes or servings, creation time, the exact food-constraint profile revision reviewed, and the weekly review event that proves the question was asked.
4. Let a proposal contain a bounded free-form meal idea, cite a journal recipe and its revision, or cite an external HTTPS recipe reference with title, canonical URL, site, discovery time, and compatibility caveat. Do not turn an external result into journal status evidence.
5. Record a weekly constraint review and a proposal withdrawal as append-only events. The proposing actor may withdraw their proposal, and a household owner may withdraw any proposal with attribution; editors cannot remove another editor's idea. Never overwrite or silently delete a proposal.
6. Add a private meal-planning profile with an explicit constraint status of unresolved, confirmed none, or recorded. Codex or Claude authors the confirmed allergy and sensitivity summary; program code validates only structure and bounds.
7. Before creating the first plan, ask: "Before I suggest meals or search the web, does anyone eating these meals have allergies or food sensitivities I should account for? You can say none."
8. On later weeks, summarize the currently recorded constraints and ask whether anything changed, then append a weekly review event even when the answer is no. If the profile or a cited journal recipe changes, mark proposals reviewed against older revisions as needing recheck.
9. Do not infer an allergy, sensitivity, diagnosis, severity, or acceptable cross-contact risk. Describe a reviewed recipe as appearing compatible with the listed ingredients, not as allergy-safe, and surface missing ingredient or cross-contact evidence.
10. Ask before sending dietary constraints to a search provider. Consent applies only to the current search and is not retained as a blanket preference. Offer a privacy-preserving alternative that searches broad recipe terms and inspects ingredients locally. Never include names, household titles, or free-form private notes in a search query.
11. Keep internet research in Codex or Claude. The Fullwell server stores only the selected bounded recipe reference and does not fetch pages, call an LLM, or retain raw pages or search queries.
12. In local-only mode, extend the existing named local update tool with purpose-specific, locked, idempotent append and event operations. Reload current state while holding the file lock so simultaneous conversations preserve both proposals.
13. In cloud mode, add purpose-specific meal-plan read and mutation tools. The proposal-add mutation authorizes against the current Git HEAD under the household lock, appends a unique path, and does not reject a request solely because another independent proposal advanced HEAD.
14. Preserve the existing durable cloud mutation states: received, locked, Git committed, projections applied, and completed. Exact retries return the first proposal; reuse of an idempotency key with changed input conflicts.
15. Keep expected-revision conflicts for the meal-planning constraints profile, withdrawal decisions that require an explicit current state, and all existing mutable tools. Do not weaken the generic mutation pipeline.
16. Add a connected-household web week view with multiple proposal cards per slot, proposer and source labels, constraint-review warnings, and explicit withdrawal. Local-only mode remains conversational and does not depend on the Fullwell website.
17. Make the feature available through one shared Codex and Claude meal-planning skill with deterministic evals for constraints, liked recipes, internet provenance, prompt injection, retries, and concurrent same-slot additions.
18. Keep meal-planning constraints and weeks out of public collection projections. Explain that a connected household's members can see the shared constraints, collect only constraint labels needed for shared meals, and avoid names or medical narratives.
19. Keep chat bullets as the default recommendation response. When at least one useful image-backed recommendation exists, end with: "Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required. Images load from their source sites."
20. On an explicit visual request, use a narrow local renderer to create one bounded static HTML snapshot under Fullwell's private local directory. This works whether the recommendation data came from a local guest journal or an authenticated cloud read; the board itself has no Fullwell session or cloud dependency.
21. Render a responsive, image-forward card grid with title, image or attractive fallback, source, why it was recommended, journal status, proposed meal slot when applicable, and compatibility state or caveat. Do not include the household's allergy or sensitivity labels in the file by default.
22. Use only already-audited or newly selected HTTPS recipe and image URLs with preserved page provenance. Do not search for unrelated decorative images, proxy images through Fullwell, download them into the journal, or embed third-party scripts, fonts, styles, trackers, forms, or analytics.
23. Generate all HTML and CSS deterministically from exact bounded inputs. Escape text, reject unsafe URL schemes and local input paths, use a restrictive meta Content Security Policy, render in DOM reading order, and create private directories and files without following symbolic links.
24. Return both an absolute file path and a `file://` URL. When the host supports a permission-visible browser-open action and the user asked to open it, use that action. Otherwise provide a clickable local link when supported and say: "If that link does not open here, say 'open the recipe board.'" Never claim the browser opened when it did not.
25. Keep a small bounded number of unique board snapshots so concurrent chats do not overwrite each other. Remove expired snapshots only during a later create or explicit cleanup; do not add a background process or local HTTP listener.
26. Near the end of the current Fullwell setup or onboarding automation, offer: "I can check in each week to plan meals. Sunday at 9:00 AM in America/Los_Angeles is the default. Want that, a different day and time, or no reminder?" Substitute the confirmed IANA time zone and do not create anything until the user confirms.
27. Prefer one durable host-native schedule per user and host installation. It is personal operational state, not a shared household setting; one cloud member changing their reminder must not change another member's reminder.
28. Use the documented host creation action when the initiating flow can invoke it and require the host's success receipt before saying it was created. If the host cannot create a schedule from the current automation, present the same prefilled task through the supported confirmation UI. Do not use undocumented browser or desktop automation.
29. Schedule a fixed, non-sensitive instruction that asks Fullwell to begin the week's planning check-in. It may load current planning state, but it must not search, select meals, create proposals, change constraints, or open a board until the user answers.
30. Default "Sunday morning" to Sunday at 9:00 AM in the confirmed time zone. Echo the exact weekday, local clock time, and time zone before creation or a permanent change. Ask for an exact time rather than silently interpreting vague terms such as "evening."
31. Support conversational inspection, permanent rescheduling, pause, resume, deletion, one-week skip, and one-time deferral. If "move it to Tuesday" could mean only this week or every week, ask which scope the user intends before changing the recurring schedule.
32. Use the host's native task list as the sole schedule authority. Before creating or changing the stable `Fullwell weekly meal planning` task, list existing tasks, reconcile duplicates, and report only host-confirmed results. Store no schedule identifier, cadence, state, or prompt history in Fullwell.
33. Preserve 9:00 AM local wall-clock time across daylight-saving changes and report the selected host's documented availability and missed-run semantics honestly. Require confirmation before following an IANA time-zone change.
34. When the scheduled task fires, explicitly invoke the Fullwell meal-planning skill and ask a concise question such as: "Ready to plan meals for the week of July 27? I can start with recipes you've liked, look for new ones, or mix both. Before I recommend anything, have the household's allergies or food sensitivities changed?" Continue through the existing constraint, search-consent, proposal, and optional visual-board flow only after the user answers.

## Non-goals

- automatically selecting one winning meal or silently resolving competing household suggestions
- guaranteeing that a recipe or packaged ingredient is free of an allergen or safe for a medical condition
- inferring allergies, sensitivities, diagnoses, religious practices, diets, or severity from recipe history
- treating Liked, Saved, or Cooked evidence as proof of present ingredient compatibility
- running an LLM, recipe crawler, or general web-search provider inside the Fullwell server
- storing raw recipe pages, raw search results, search queries, names, or unrelated health information
- silently saving an internet result as a journal recipe or marking it Saved, Cooked, or Liked
- generating grocery carts, checking out, nutrition plans, calorie targets, or clinical diet advice
- building a persistent local web application, HTTP listener, image proxy, or background synchronization process
- adding a Fullwell server cron job, calendar event, push notification, email, WhatsApp message, launchd job, or OS-level scheduler fallback
- automatically researching recipes, choosing meals, writing proposals, or changing constraints when the weekly task fires
- treating a personal host schedule as shared household content or storing it in Git, Neon, a public collection, or a cloud export
- creating, changing, or deleting a host schedule without explicit user intent and a documented host success result
- publishing the board, making it reachable from another device, or replacing the authenticated collaborative cloud week view
- making the board editable or treating its snapshot as journal authority
- requiring a Fullwell account, OAuth session, Pinterest account, or third-party board account to view the local file
- downloading arbitrary remote images, embedding active third-party content, or promising that every source permits hotlinking
- weakening revision checks for mutable journal, profile, membership, collection, or account operations
- auto-merging arbitrary Markdown or allowing callers to choose Git paths

## Priority and sequencing

Keep this in `next` because the product value is high and the underlying recipe, local journal, Git mutation, projection, web, and cross-host skill surfaces already exist. Implement it only through the active ExecPlan because the feature changes the repository format, mutation conflict semantics, private profile content, agent behavior, and browser UI.

Begin with a feasibility and contract milestone. It must prove current Codex and Claude search, local-file-opening, and native task-management capabilities. Current official Codex scheduled-task documentation establishes that chat can create or update tasks and that task prompts can invoke skills; current Claude Desktop documentation establishes conversational task management. The implementation must define search and remote-image disclosures, verify old-client handling of new local state, and prove that an older server can safely ignore or preserve new Git paths during rollback. Next, implement typed domain contracts and additive storage semantics before exposing the skill or browser surfaces. The static visual board can release with the local skill after its file, privacy, host, and accessibility gates pass; shared cloud mutation still requires the cloud canary.

## Open questions

- Which current Codex and Claude host surfaces provide a supported, permission-visible internet search in every installation mode?
- Which installed Codex and Claude surfaces expose every documented native task-management action needed for create, inspect, edit, pause, resume, skip, and remove?
- Should Claude installations use Claude Code Desktop local tasks, Cowork remote scheduled tasks, or a capability-selected choice when local journal access is required?
- How do each host's daylight-saving, missed-run, sleep, jitter, and duplicate-task semantics map to one honest Fullwell check-in contract without storing parallel Fullwell schedule state?
- Which supported Codex and Claude surfaces can open a generated local HTML file directly, which render `file://` links as clickable, and which require an OS/browser fallback?
- Which recipe image hosts work with privacy-preserving anonymous image requests, and should the board offer a text-only retry when a host rejects them?
- Should custom meal labels be household-defined profile values or bounded labels stored directly on each proposal?
- Does the existing JSONB household projection need any Neon schema change, or can proposals and events remain rebuildable inside the current projection representation?
- What is the smallest useful default retention window for displaying old weeks while preserving Git history indefinitely?
- Which constraints should be included in a minimal external query after consent, and which should always be checked locally against ingredients?
- How should the web experience explain that ingredient lists and manufacturer cross-contact statements can change after a proposal was reviewed?
- What release pairing is required so an older deployed server will not discard, quarantine, or misproject the new meal-plan paths after rollback?

## Promotion trigger

Promoted on `2026-07-23` and completed on `2026-07-24` at `docs/exec-plans/completed/2026-07-23-collaborative-household-meal-planning.md`. Milestone 0 resolved the host-search, host-scheduling, privacy, repository-compatibility, local-concurrency, and projection-shape decisions before implementation began.
