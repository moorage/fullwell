# Fullwell Agent Client

One shared skill package connects Codex and Claude to the hosted Household Food Journal MCP service and defines local-only onboarding checkpoints and grocery restocking. The service performs authentication and all canonical journal mutations; the published package contains no credentials or household data and includes no Git client or journal synchronization state.

After installation, start with `@Fullwell hi` in Codex or `Set up Fullwell.` in Claude. A bare greeting reads one onboarding snapshot before replying: while work remains, the shared skills begin snacks, ask only for missing source authorization and preferences, then advance to recipes without a setup menu or generic help question. The unconfirmed draft is checkpointed under `~/.codex/fullwell/drafts`, isolated by the stable Fullwell user and household IDs and bound to the current snapshot, so long audits can resume after a closed conversation. It excludes credentials and browser state and is deleted after confirmed finalization or explicit cancellation. Fullwell writes canonical state once only after showing a final summary and receiving explicit confirmation. A section is complete only when its canonical household report exists.

The restocking skill reads only a private revisioned snapshot prepared by `@fullwell/local-runner`. Product selection and retailer cart control stay on the user's Mac; the WhatsApp gateway relays encrypted user-facing text and transport state only.

Removing the plugin does not delete an unfinished checkpoint. Delete `~/.codex/fullwell/drafts` to remove every local Fullwell onboarding draft for the current operating-system account without changing server household data.

## Development

- `npm run test:packaging --workspace @fullwell/fullwell` validates host manifests, catalogs, skills, references, MCP metadata, packaged-file privacy, and isolated install/remove lifecycles when the host CLIs are available.
- `npm run test:evals --workspace @fullwell/fullwell` validates that the release eval matrix covers every normative client case on both hosts.
- Repository marketplace catalogs live at `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude. Both point to the same immutable npm package version.
- Official Codex and Claude validators remain part of the manual release matrix because their binaries and authenticated host surfaces are not CI prerequisites.

The production MCP URL is `https://fullwell.souschefstudio.com/mcp`. OAuth occurs in the service-controlled browser flow; users never paste a token into a conversation.
