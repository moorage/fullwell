# Household Food Journal Agent Client

One shared skill package connects Codex and Claude to the hosted Household Food Journal MCP service. The service performs authentication and all canonical mutations; this package contains no credentials, household data, Git client, or synchronization state.

## Development

- `npm run test:packaging --workspace @fullwell/household-food-journal-agent` validates host manifests, catalogs, skills, references, MCP metadata, and packaged-file privacy.
- `npm run test:evals --workspace @fullwell/household-food-journal-agent` validates that the release eval matrix covers every normative client case on both hosts.
- Official Codex and Claude validators remain part of the manual release matrix because their binaries and authenticated host surfaces are not CI prerequisites.

The production MCP URL is `https://journal.fullwell.app/mcp`. OAuth occurs in the service-controlled browser flow; users never paste a token into a conversation.
