# Fullwell Agent Client

One shared skill package connects Codex and Claude to the hosted Household Food Journal MCP service and defines the local-only grocery-restocking workflow. The service performs authentication and all canonical journal mutations; this package contains no credentials, household data, Git client, or synchronization state.

After installation, start with `@Fullwell hi` in Codex or `Set up Fullwell.` in Claude. The shared skills ask about grocery sources first and recipe sources second, skip a declined section without showing a setup menu, and resume per-user progress through the hosted MCP service. A section is complete only when its canonical household report exists.

The restocking skill reads only a private revisioned snapshot prepared by `@fullwell/local-runner`. Product selection and retailer cart control stay on the user's Mac; the WhatsApp gateway relays encrypted user-facing text and transport state only.

## Development

- `npm run test:packaging --workspace @fullwell/fullwell` validates host manifests, catalogs, skills, references, MCP metadata, packaged-file privacy, and isolated install/remove lifecycles when the host CLIs are available.
- `npm run test:evals --workspace @fullwell/fullwell` validates that the release eval matrix covers every normative client case on both hosts.
- Repository marketplace catalogs live at `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude. Both point to the same immutable npm package version.
- Official Codex and Claude validators remain part of the manual release matrix because their binaries and authenticated host surfaces are not CI prerequisites.

The production MCP URL is `https://fullwell.souschefstudio.com/mcp`. OAuth occurs in the service-controlled browser flow; users never paste a token into a conversation.
