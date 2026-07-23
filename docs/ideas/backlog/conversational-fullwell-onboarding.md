# Conversational Fullwell Onboarding

## Snapshot

- Status: `promoted`
- Priority lane: `now`
- Impact: `high`
- Confidence: `high`
- Effort: `medium`
- Last reviewed: `2026-07-22`

## Why this matters

Installing Fullwell currently exposes useful starter prompts but does not guide a new user from installation to the recurring-snack and recipe-index reports that power the product. A user can send a WhatsApp restocking request before any purchase evidence exists and receive a correct but confusing blocked response. Fullwell needs a short first-run conversation that gives the user a concrete reason for each section before asking its first necessary question, then naturally advances when a user has nothing to audit or does not want to continue.

## Current evidence

- The Codex manifest already advertises `Set up my household food journal`, but the shared household-management skill stops after household creation and does not coordinate the snack and recipe workflows.
- The server returns an `onboarding_state` only from household creation; `hfj_get_context` has no resumable section state.
- Snack and recipe reports already have separate evidence-first skills and canonical Git paths, so onboarding should coordinate rather than duplicate them.
- The user explicitly requested that `@Fullwell hi` begin asking questions without a setup menu and that natural replies such as `no`, `I do not have recipes`, or `nevermind` advance to the next section.
- Real Codex onboarding then showed that separately persisting start, skip, profile, evidence, and report steps caused repeated MCP approval prompts. On 2026-07-21 the user approved a read-draft-commit iteration that reduces the normal Fullwell path to one initial read plus one final confirmed write. A subsequent long grocery audit showed conversation-only state was too fragile, so the user approved a local Codex-home checkpoint sharded by stable Fullwell user and household IDs.
- A live resume prompt that only said "snack setup" did not explain the payoff to a new user. Snack onboarding should connect past orders to a concrete request such as "Restock cashews," and recipe onboarding should connect saved/cooked/liked history to finding family favorites again before either section asks for sources.
- The first complete grocery audit produced 196 items and 804 evidence records, exceeding the provisional 100-item/500-evidence finalization caps. Guided finalization must accept up to 10,000 of each inside the separately bounded 16 MiB MCP request instead of forcing extra approval prompts for a normal history.
- The bundled grocery-audit skill said to inspect each order and expand item lists, but did not explicitly tell the authorized browser workflow that listing cards are incomplete discovery surfaces. Every qualifying order needs a detail-page visit and complete item expansion before the audit can claim coverage.
- The user asked the same pass to learn ingredients, condiments, and other groceries so later requests such as buying parsley or excluding Japanese-style mayonnaise can use the usual historical product and store. The recurrence threshold must not discard low-frequency identities.
- The user rejected authentication as the first-run gate because a single-user grocery and recipe journal has useful local value before collaboration. A new installation should ask whether the person already has a Fullwell account, use OAuth only when they answer yes, and otherwise collect into a durable local household before offering optional cloud backup for WhatsApp, sharing, or multiplayer use.
- The first account-free run still exposed a raw approval for `node <plugin-cache>/1.1.8/runtime/local-household.mjs`; accepting that exact prefix would ask again after every immutable package upgrade. Codex npm plugin installs do not run lifecycle scripts, so the upgrade-stable boundary should be a plugin-provided local MCP server with stable read, update, and destructive-delete tool identities rather than a self-installed executable or broad Node rule.

## Proposed direction

Treat onboarding as a small typed state machine with an approval-efficient orchestration layer and two explicit authority modes. Before any hosted tool call, a fresh install reads through a stable plugin-provided local tool and asks whether the person already has a Fullwell account. Existing account holders use the current OAuth and hosted-household path. Everyone else initializes a bounded, atomic local household under the active Codex home through a stable non-destructive update tool, completes the same grocery-then-recipe audit without a Fullwell cloud call, and can use that local journal for direct restocking and recipe recall. Destructive cancellation remains a separate tool. After local collection is safely finalized, the host offers an optional Fullwell account and cloud backup, explaining that it enables WhatsApp, sharing, and family access. A successful promotion authenticates, reconciles against the selected hosted household, commits once through the existing typed onboarding boundary, and records the cloud linkage locally without deleting the local copy. A failed, declined, or interrupted promotion leaves the local journal authoritative and usable.

## Non-goals

- Automatically inspect a browser, retailer, bookmark service, notes application, or communication source after installation.
- Add keyword classifiers for decline phrases or food semantics.
- Add a separate MCP tool for every onboarding transition.
- Change the stable host plugin, OAuth client, or MCP service identifiers.
- Add automatic background synchronization between a guest journal and a hosted household.
- Make WhatsApp, collection sharing, or multiplayer access work without a Fullwell account.

## Priority and sequencing

This is a `now` item because a populated journal is a prerequisite for useful recurring reports and evidence-backed restocking. Implement the typed contract and operational persistence first, then service derivation and mutation behavior, then agent/UI entry points and evals. Keep it in a separate ExecPlan from WhatsApp restocking so either feature can be reviewed and rolled back independently.

## Open questions

- Staging must confirm the exact rendered Codex plugin mention in a prefilled deep link after the new public package version is installed.
- Claude does not share Codex deep links, so its public install flow should continue to use the same natural-language `Set up Fullwell` prompt.

## Promotion trigger

Promoted on 2026-07-21 when the user approved implementation of the typed onboarding tool and sequential first-run conversation.
