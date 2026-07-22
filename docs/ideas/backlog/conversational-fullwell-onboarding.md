# Conversational Fullwell Onboarding

## Snapshot

- Status: `promoted`
- Priority lane: `now`
- Impact: `high`
- Confidence: `high`
- Effort: `medium`
- Last reviewed: `2026-07-21`

## Why this matters

Installing Fullwell currently exposes useful starter prompts but does not guide a new user from installation to the recurring-snack and recipe-index reports that power the product. A user can send a WhatsApp restocking request before any purchase evidence exists and receive a correct but confusing blocked response. Fullwell needs a short first-run conversation that gives the user a concrete reason for each section before asking its first necessary question, then naturally advances when a user has nothing to audit or does not want to continue.

## Current evidence

- The Codex manifest already advertises `Set up my household food journal`, but the shared household-management skill stops after household creation and does not coordinate the snack and recipe workflows.
- The server returns an `onboarding_state` only from household creation; `hfj_get_context` has no resumable section state.
- Snack and recipe reports already have separate evidence-first skills and canonical Git paths, so onboarding should coordinate rather than duplicate them.
- The user explicitly requested that `@Fullwell hi` begin asking questions without a setup menu and that natural replies such as `no`, `I do not have recipes`, or `nevermind` advance to the next section.
- Real Codex onboarding then showed that separately persisting start, skip, profile, evidence, and report steps caused repeated MCP approval prompts. On 2026-07-21 the user approved a read-draft-commit iteration that reduces the normal Fullwell path to one initial read plus one final confirmed write. A subsequent long grocery audit showed conversation-only state was too fragile, so the user approved a local Codex-home checkpoint sharded by stable Fullwell user and household IDs.
- A live resume prompt that only said "snack setup" did not explain the payoff to a new user. Snack onboarding should connect past orders to a concrete request such as "Restock cashews," and recipe onboarding should connect saved/cooked/liked history to finding family favorites again before either section asks for sources.
- The bundled grocery-audit skill said to inspect each order and expand item lists, but did not explicitly tell the authorized browser workflow that listing cards are incomplete discovery surfaces. Every qualifying order needs a detail-page visit and complete item expansion before the audit can claim coverage.

## Proposed direction

Treat onboarding as a small typed state machine with an approval-efficient orchestration layer. `hfj_get_context` returns the stable authenticated user ID, per-user section state, both profiles, and a bounded item identity index from one consistent selected-household snapshot. Before the first question in each new or resumed section, the host briefly explains what that history enables in everyday terms; it never relies on an unexplained "setup" label. The host checkpoints the unconfirmed snack-and-recipe draft under the Codex home with exact user, household, HEAD, onboarding-revision, and local-draft-revision binding, presents one final summary, and calls `hfj_commit_onboarding` once after explicit confirmation. That final tool validates same-request evidence and conclusions together, creates one canonical Git commit when content changes, and compare-and-sets bounded Neon skip outcomes with recovery intent. The legacy `hfj_update_onboarding` transition remains compatible with older clients. Household-wide completion remains derived from canonical reports.

## Non-goals

- Automatically inspect a browser, retailer, bookmark service, notes application, or communication source after installation.
- Add keyword classifiers for decline phrases or food semantics.
- Add a separate MCP tool for every onboarding transition.
- Change the stable host plugin, OAuth client, or MCP service identifiers.
- Make onboarding completion authoritative outside the household Git repository.

## Priority and sequencing

This is a `now` item because a populated journal is a prerequisite for useful recurring reports and evidence-backed restocking. Implement the typed contract and operational persistence first, then service derivation and mutation behavior, then agent/UI entry points and evals. Keep it in a separate ExecPlan from WhatsApp restocking so either feature can be reviewed and rolled back independently.

## Open questions

- Staging must confirm the exact rendered Codex plugin mention in a prefilled deep link after the new public package version is installed.
- Claude does not share Codex deep links, so its public install flow should continue to use the same natural-language `Set up Fullwell` prompt.

## Promotion trigger

Promoted on 2026-07-21 when the user approved implementation of the typed onboarding tool and sequential first-run conversation.
