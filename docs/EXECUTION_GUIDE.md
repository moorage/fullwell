# Execution Guide

Use this file as the step-by-step guide once an ExecPlan exists.
If the work is still exploratory and no ExecPlan exists yet, use `docs/ideas/` first; this loop starts when the work has crossed into execution.

## Execution rules

1. Treat the active ExecPlan as the source of truth.
2. Work one milestone at a time.
3. Keep diffs scoped to the current milestone when practical.
4. Run the milestone's narrow validation commands before moving to broader verification.
5. If validation fails, fix the issue before starting the next milestone.
6. Update the ExecPlan `Progress`, `Decision Log`, and `Surprises & Discoveries` after each meaningful stop.
7. Update `docs/IMPLEMENTATION_LOG.md` with what changed, what was verified, and what remains.
8. Prefer additive, reversible changes when risk is high.
9. If the plan changes materially, update the plan before or while changing the code, not after.

## Local container workflow

On an Apple silicon macOS development host, use Apple's `container` CLI through the repository actions. Require version 0.12.0 or newer for image builds; older releases contain an upstream build-context archive defect. `npm run container:postgres:start` creates or resumes the labeled `hfj-postgres` container and persistent `hfj-postgres-data` volume on `127.0.0.1:55432`. It writes generated credentials only to ignored `.codex/runtime/` state and refuses unmanaged name collisions or a volume whose credential file is missing.

Run `npm run container:postgres:verify` for migration up/down/up followed by the real PostgreSQL integration suite, `npm run container:postgres:stop` to stop the container without deleting its volume, and `npm run container:build` to build the application OCI image from `Dockerfile`.

The DigitalOcean Droplet runs Ubuntu, so production continues to use the checked-in Docker Compose and systemd units. Do not rewrite those Linux deployment assets around the macOS-only Apple Container CLI.

## Useful loop

1. Read the current milestone.
2. Inspect the relevant code paths and docs.
3. Implement the smallest coherent slice.
4. Run narrow validation first.
5. Run broader verification if the slice passes.
6. Update the plan and `docs/IMPLEMENTATION_LOG.md`.
7. Continue or stop with the repo in a coherent state.
