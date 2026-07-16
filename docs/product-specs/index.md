# Product Specs Index

This directory is the normative source for user-visible behavior, data authority, security constraints, and acceptance criteria.

## Active specifications

| Status | Surface | Specification |
| --- | --- | --- |
| Ready for implementation | Hosted TypeScript service, React 19.2 web experience, DigitalOcean deployment, Neon operational database, and authoritative Git store | `docs/product-specs/household-food-journal-server.md` |
| Ready for implementation | Shared Codex and Claude agent client, MCP workflows, packaging, tests, and evals | `docs/product-specs/household-food-journal-client.md` |

The two specifications are companions. A contract change in one must be checked against the other in the same change.

## Approved stack decisions

- React and React DOM 19.2 for browser workflows.
- One containerized TypeScript application service on a DigitalOcean Droplet.
- DigitalOcean Block Storage mounted at `/data/households` for authoritative household Git repositories.
- Neon PostgreSQL for operational state and rebuildable projections.
- One shared Codex/Claude agent-client source package.

## Maintenance rule

- Update the matching spec with every user-visible or contract behavior change.
- Update both specs when an MCP tool, authorization rule, semantic responsibility, or error contract changes.
- Change a status only when implementation and acceptance evidence justify it.
- Verify current vendor protocol and packaging details against primary documentation during implementation and before release.
