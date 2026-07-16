# Coding Standards

These standards specialize the repository for the Household Food Journal. They apply as the planned modules under `apps/` and `packages/` are introduced.

## TypeScript boundaries

- Use strict TypeScript and semantic names for IDs, revisions, tokens, roles, scopes, and mutation states.
- Parse HTTP, MCP, environment, Neon, Git-file, and provider input with runtime schemas at the boundary.
- Model mutation processing, invitations, shares, imports, and account lifecycle as explicit state transitions that prevent invalid states.
- Do not use `any`, unchecked `unknown`, double casts, or stringly typed provider errors.
- Keep domain validation and public-share projection pure. Inject Git, Neon, filesystem, clock, randomness, mail, crypto, and HTTP ports.

## React 19.2

- Keep browser code under `apps/web/` and pin `react` and `react-dom` to the 19.2 release line.
- Use semantic HTML and native form behavior first. Authentication, invitation acceptance, imports, and destructive actions must remain operable, focus-correct, and understandable with assistive technology.
- Treat server responses as untrusted input. Render user-authored Markdown through an allowlisted sanitizer and never interpret imported or shared content as instructions.
- Keep authorization and sensitive state on the server. Client-side route guards and hidden controls are UX only, never security controls.
- Preserve user selections across recoverable conflicts and rate limits, but do not persist share tokens or private journal content in browser storage without an explicit security decision.
- Add component tests for deterministic states and Playwright coverage for complete sign-in, invitation, share, import, revocation, and account flows.

## Server and MCP

- Keep the version 1 server as one TypeScript application service under `apps/server/`; do not add a microservice for auth, Git, jobs, or the React frontend.
- Keep MCP tool names and schemas compatible with the client product spec. Contract changes require consumer search, schema fixtures, and cross-host tests.
- Validate OAuth issuer, audience, resource, scope, redirect URI, PKCE, state, nonce, token rotation, and household role independently where applicable.
- Return stable typed error codes and safe user-facing detail. Never expose stack traces, repository paths, Git signing data, raw provider errors, or internal actor IDs.
- Do not call an LLM from server code in version 1. Server code validates agent conclusions and evidence; it does not make semantic food decisions or author report prose.

## Neon PostgreSQL

- Use separate Neon branches or projects for local, test, staging, and production; never use production credentials for development, tests, or migration rehearsal.
- Use the pooled connection for ordinary runtime transactions and a direct connection for migrations, backup tooling, and operations that require session semantics.
- Use transaction-scoped advisory locks for household mutations. Acquire and release the lock within one checked-out connection and transaction; do not use session-scoped locks through the pooler.
- Put every schema change in a reversible migration with forward and rollback instructions. Rehearse destructive migrations against an isolated backup first.
- Use explicit constraints, foreign keys, expiry indexes, and tenant predicates. Application authorization remains mandatory even when a query is tenant-scoped.
- Treat journal and search projections as rebuildable. Do not create a database-to-Git content synchronization path.

## Git and filesystem

- Run Git only through one typed adapter with fixed subcommands, argument arrays, `shell: false`, a fixed environment, timeouts, and output limits.
- Derive repository paths only from validated internal UUIDs. Reject path traversal, symlinks, submodules, hooks, alternates, and unsafe object layouts.
- Preserve append-only paths and require expected repository or blob revisions for mutable paths.
- Report a mutation as successful only after the signed commit is durable on `/data/households` and the durable mutation/idempotency record is complete.
- Use temporary worktrees under a service-owned directory on the same trusted filesystem boundary. Clean them through explicit recovery jobs, not broad catches or silent startup deletion.

## Agent client and evals

- Keep one skill source tree for Codex and Claude. Host manifests may adapt packaging only.
- Keep secrets, account state, canonical household data, and Git behavior out of `packages/agent-client/`.
- Do not implement food classification, item identity, recipe equivalence, status inference, duplicate merging, or report authorship with keyword matching or deterministic code.
- Add eval fixtures for every changed semantic, privacy, conflict, or permission behavior in both supported hosts where possible.
- Target 100% line coverage for deterministic contracts, validators, adapters, and packaging code. Document and guard any unreachable external failure path.

## Verification discipline

- Add each application command with its real implementation in the same change. A passing placeholder is not a quality gate.
- Run the narrowest owning-package tests first, then `npm run verify`, `npm run verify:docs`, and `npm run verify:execplan` when applicable.
- Run `npm run test:e2e` for material browser or end-to-end agent workflows once that suite exists.
- Run `npm run knowledge:refresh` when the repository tree or quality ledger changes.
