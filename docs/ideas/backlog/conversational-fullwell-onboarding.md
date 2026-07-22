# Conversational Fullwell Onboarding

## Snapshot

- Status: `promoted`
- Priority lane: `now`
- Impact: `high`
- Confidence: `high`
- Effort: `medium`
- Last reviewed: `2026-07-21`

## Why this matters

Installing Fullwell currently exposes useful starter prompts but does not guide a new user from installation to the recurring-snack and recipe-index reports that power the product. A user can send a WhatsApp restocking request before any purchase evidence exists and receive a correct but confusing blocked response. Fullwell needs a short first-run conversation that begins with the first necessary question and naturally advances when a user has nothing to audit or does not want to continue a section.

## Current evidence

- The Codex manifest already advertises `Set up my household food journal`, but the shared household-management skill stops after household creation and does not coordinate the snack and recipe workflows.
- The server returns an `onboarding_state` only from household creation; `hfj_get_context` has no resumable section state.
- Snack and recipe reports already have separate evidence-first skills and canonical Git paths, so onboarding should coordinate rather than duplicate them.
- The user explicitly requested that `@Fullwell hi` begin asking questions without a setup menu and that natural replies such as `no`, `I do not have recipes`, or `nevermind` advance to the next section.
- Real Codex onboarding then showed that separately persisting start, skip, profile, evidence, and report steps caused repeated MCP approval prompts. On 2026-07-21 the user approved a read-draft-commit iteration that keeps unconfirmed work ephemeral and reduces the normal Fullwell path to one initial read plus one final confirmed write.

## Proposed direction

Treat onboarding as a small typed state machine with an approval-efficient orchestration layer. `hfj_get_context` returns per-user section state plus both profiles and a bounded item identity index from one consistent selected-household snapshot. The host keeps the unconfirmed snack-and-recipe draft only in the active conversation, presents one final summary, and calls `hfj_commit_onboarding` once after explicit confirmation. That final tool validates same-request evidence and conclusions together, creates one canonical Git commit when content changes, and compare-and-sets bounded Neon skip outcomes with recovery intent. The legacy `hfj_update_onboarding` transition remains compatible with older clients. Household-wide completion remains derived from canonical reports.

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
