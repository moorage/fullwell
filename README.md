# Household Food Journal

This repository is the implementation harness for a hosted Household Food Journal and its shared Codex/Claude agent client.

The application is not implemented yet. The accepted target is:

- React 19.2 for browser sign-in, household, invitation, collection, and import flows;
- one containerized TypeScript service on a DigitalOcean Droplet;
- DigitalOcean Block Storage mounted at `/data/households` for authoritative household Git repositories;
- Neon PostgreSQL for operational identity, OAuth, authorization projections, idempotency, locking, and jobs;
- one shared agent-client source package for Codex and Claude.

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

The current `verify` command validates the harness, Git hooks, self-improvement loop, documentation, ideas, and ExecPlans. Application lint, typecheck, test, eval, build, and deployment commands must be added with the first corresponding implementation slice; do not represent an unimplemented suite with a passing placeholder.

Every commit message must include exactly one trailer:

```text
AI-Model: gpt-5.5
```

Use `AI-Model: none` when no AI model was used.
