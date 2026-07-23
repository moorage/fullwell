# Household Food Journal

This repository implements Fullwell's local-first Household Food Journal, its shared Codex/Claude agent client, and the optional hosted service for backup, WhatsApp, sharing, and family access.

The implemented architecture uses:

- React 19.2 for browser sign-in, household, invitation, collection, and import flows;
- one containerized TypeScript service on a DigitalOcean Droplet;
- DigitalOcean Block Storage mounted at `/data/households` for authoritative household Git repositories;
- Neon PostgreSQL for operational identity, OAuth, authorization projections, idempotency, locking, and jobs;
- one shared agent-client source package for Codex and Claude, with an account-free local guest household under the active Codex home.

After installation, `@Fullwell hi` asks whether the person already has an account. Existing users connect through OAuth. Everyone else can complete grocery and recipe onboarding and use the resulting journal locally before deciding whether to create an account for cloud features.

Product truth lives in:

- `docs/product-specs/household-food-journal-server.md`
- `docs/product-specs/household-food-journal-client.md`

Start with `AGENTS.md`, then read `docs/ARCHITECTURE.md` and the relevant product spec. Application scaffolding must follow an active ExecPlan.

## Harness setup

Use Node 24 LTS.

```sh
npm install
npm run hooks:install
npm run verify
```

On Apple silicon macOS, use Apple's `container` CLI for local container work. Version 0.12.0 or newer is required for image builds. The repository manages an isolated PostgreSQL 17 container and volume without printing its generated local-only password:

```sh
npm run container:postgres:start
npm run container:postgres:verify
npm run container:postgres:stop
```

The local database listens only on `127.0.0.1:55432`; its credential file is ignored under `.codex/runtime/`. Build the application OCI image locally with `npm run container:build`. Docker Compose remains the production orchestrator on the DigitalOcean Ubuntu host and is not the local macOS harness.

The current `verify` command validates the harness, Git hooks, self-improvement loop, documentation, ideas, and ExecPlans. Application lint, typecheck, test, eval, build, and deployment commands must be added with the first corresponding implementation slice; do not represent an unimplemented suite with a passing placeholder.

Every commit message must include exactly one trailer:

```text
AI-Model: gpt-5.5
```

Use `AI-Model: none` when no AI model was used.
