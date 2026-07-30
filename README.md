# Household Food Journal

This repository implements Fullwell's local-first Household Food Journal, its shared Codex/Claude agent client, and the optional hosted service for backup, WhatsApp, sharing, and family access.

The implemented architecture uses:

- React 19.2 for browser sign-in, household, invitation, collection, and import flows;
- one containerized TypeScript service on a DigitalOcean Droplet;
- DigitalOcean Block Storage mounted at `/data/households` for authoritative household Git repositories;
- Neon PostgreSQL for operational identity, OAuth, authorization projections, idempotency, locking, and jobs;
- one shared agent-client source package for Codex and Claude, with a cloud-account-free local guest household under the active Codex home.

After installation, `@Fullwell hi` first asks and privately remembers what to call the person, warmly acknowledges the answer by name, then asks whether they already have a Fullwell cloud account. Existing cloud-account users connect through OAuth and keep that name as their cloud display name. Everyone else gets a deterministically named first local household, can complete grocery and recipe onboarding without a cloud account, and may later connect for cloud features. Fullwell can also build an additive weekly household meal plan from liked recipes, separately approved web research, or free-form ideas; local users can open a private image-forward recipe board, while connected households gain a shared authenticated week view.

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

## Sensitive repository content

Never commit credentials, access or refresh tokens, private keys, production
secret files, credential-bearing URLs, private tracker exports, author-specific
absolute paths, or private operational evidence. Keep runtime credentials in the
documented ignored files, operating-system credential stores, or encrypted
deployment credential store; use placeholders, stable hostnames, and role names
in source and documentation.

Run `npm run verify:sensitive` before staging a publication change. The installed
pre-commit hook checks the final staged content, and `npm run verify` checks the
working repository. If either check finds a real credential, remove it from Git
and rotate it immediately. Do not weaken or bypass the scanner to make a commit
pass.

## License and private project data

The source is publicly viewable but `UNLICENSED`; see `LICENSE`. Public
visibility does not grant permission to reuse or redistribute it.

Beads issue and interaction exports are private maintainer data. They are
ignored, are not part of the application source, and must not be synced to this
repository through Git refs. A maintainer without the private local Beads store
can initialize a new local-only store, but must not configure this repository as
its Dolt remote.
