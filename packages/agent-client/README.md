# Fullwell Agent Client

One shared skill package gives Codex and Claude a local-first food journal and an optional connection to the hosted Household Food Journal MCP service. A new user can collect grocery and recipe history without an account. The service performs authentication and every cloud-household mutation; the published package contains no credentials or bundled household data and includes no Git client or background synchronization engine.

After installation, start with `@Fullwell hi` in Codex or `Set up Fullwell.` in Claude. A fresh greeting first asks `What should I call you?` and remembers the answer in a private revisioned local profile. Fullwell then asks whether the person already has an account. Existing account holders use hosted OAuth, copy the confirmed name to their cloud display name, and receive a first household named `Name's Household` (or `Names' Household`) only when they are not joining or resuming another household. Everyone else initializes that named private guest household under `~/.codex/fullwell/local/household.json`, begins one grocery-history pass for snacks, ingredients, condiments, and more, and advances to recipes without any Fullwell cloud call. The plugin-provided `fullwell-local` server exposes stable profile, household, runner-control, and collecting-only deletion tools, so narrow host permissions can survive package upgrades without allowing arbitrary Node commands. Local files use atomic revision-checked writes and exclude credentials, browser state, screenshots, and raw pages. After the journal is usable locally, the agent offers optional account creation and cloud backup for WhatsApp, sharing, or family access.

Authenticated onboarding still checkpoints unconfirmed work under `~/.codex/fullwell/drafts`, isolated by the stable Fullwell user and household IDs and bound to the current snapshot. One confirmed hosted commit persists it. Promoting a guest journal retains the local copy and records cloud linkage only after a successful hosted response.

The restocking skill reads only a private revisioned snapshot prepared by `@fullwell/local-runner`. Product selection and retailer cart control stay on the user's Mac; the WhatsApp gateway relays encrypted user-facing text and transport state only. Complete USD requests strictly below the profile's automatic cart-add maximum use bounded automatic authority, while equal or greater amounts require request-scoped confirmation. Direct conversations can change the maximum without granting the linked runner profile-write access. After a verified direct-local add, an unconnected guest resumes the optional Fullwell cloud offer; connected and linked WhatsApp use omits it.

Meal planning works locally without an account and collaboratively in a connected cloud household. It records an explicit allergy and food-sensitivity answer plus a weekly review before recommending anything, can start from actual Liked evidence or separately approved internet research, and keeps multiple people's ideas in the same slot instead of overwriting them. Chat remains primary; after the user accepts, the local tool can render those recommendations as a private static image-forward recipe board that opens without a Fullwell login.

After successful setup, the agent can offer one personal native Codex or Claude task named `Fullwell weekly meal planning`, with Sunday at 9:00 AM in the confirmed time zone as the default. The task only starts a conversation and waits; it does not search or write automatically. Fullwell stores no scheduler state and creates no launchd job, cron, calendar event, server worker, or notification fallback.

In chat, a person can change their remembered name, rename an owner-managed household, stop the local WhatsApp runner without disconnecting it, or remove the exact weekly meal-planning task. Eligible cloud setup can also suggest inviting another household member or making a collection, for example: `Make a Weeknight Favorites collection from the recipes we liked.`

Removing the plugin does not delete an unfinished checkpoint or guest household. Delete `~/.codex/fullwell/drafts` to remove authenticated onboarding drafts. Delete `~/.codex/fullwell/local` only when you intentionally want to remove the local guest journal; neither action changes server household data.

Before removing or rolling back the meal-planning skill, pause or remove its native weekly task in the selected host. If the host cannot confirm cleanup, the task remains host-owned and Fullwell reports that follow-up instead of claiming removal.

## Development

- `npm run test:packaging --workspace @fullwell/fullwell` validates host manifests, catalogs, skills, references, MCP metadata, packaged-file privacy, and isolated install/remove lifecycles when the host CLIs are available.
- `npm run test:evals --workspace @fullwell/fullwell` validates that the release eval matrix covers every normative client case on both hosts.
- Repository marketplace catalogs live at `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude. Both point to the same immutable npm package version.
- Official Codex and Claude validators remain part of the manual release matrix because their binaries and authenticated host surfaces are not CI prerequisites.

The production MCP URL is `https://fullwell.souschefstudio.com/mcp`. OAuth occurs in the service-controlled browser flow; users never paste a token into a conversation.
