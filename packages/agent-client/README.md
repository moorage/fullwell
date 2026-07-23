# Fullwell Agent Client

One shared skill package gives Codex and Claude a local-first food journal and an optional connection to the hosted Household Food Journal MCP service. A new user can collect grocery and recipe history without an account. The service performs authentication and every cloud-household mutation; the published package contains no credentials or bundled household data and includes no Git client or background synchronization engine.

After installation, start with `@Fullwell hi` in Codex or `Set up Fullwell.` in Claude. A fresh greeting first asks whether the person already has a Fullwell account. Existing account holders use hosted OAuth. Everyone else initializes one private guest household under `~/.codex/fullwell/local/household.json`, begins one grocery-history pass for snacks, ingredients, condiments, and more, and advances to recipes without any Fullwell MCP call. The local journal uses atomic revision-checked writes and excludes credentials, browser state, screenshots, and raw pages. After it is usable locally, the agent offers optional account creation and cloud backup for WhatsApp, sharing, or family access.

Authenticated onboarding still checkpoints unconfirmed work under `~/.codex/fullwell/drafts`, isolated by the stable Fullwell user and household IDs and bound to the current snapshot. One confirmed hosted commit persists it. Promoting a guest journal retains the local copy and records cloud linkage only after a successful hosted response.

The restocking skill reads only a private revisioned snapshot prepared by `@fullwell/local-runner`. Product selection and retailer cart control stay on the user's Mac; the WhatsApp gateway relays encrypted user-facing text and transport state only.

Removing the plugin does not delete an unfinished checkpoint or guest household. Delete `~/.codex/fullwell/drafts` to remove authenticated onboarding drafts. Delete `~/.codex/fullwell/local` only when you intentionally want to remove the local guest journal; neither action changes server household data.

## Development

- `npm run test:packaging --workspace @fullwell/fullwell` validates host manifests, catalogs, skills, references, MCP metadata, packaged-file privacy, and isolated install/remove lifecycles when the host CLIs are available.
- `npm run test:evals --workspace @fullwell/fullwell` validates that the release eval matrix covers every normative client case on both hosts.
- Repository marketplace catalogs live at `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude. Both point to the same immutable npm package version.
- Official Codex and Claude validators remain part of the manual release matrix because their binaries and authenticated host surfaces are not CI prerequisites.

The production MCP URL is `https://fullwell.souschefstudio.com/mcp`. OAuth occurs in the service-controlled browser flow; users never paste a token into a conversation.
