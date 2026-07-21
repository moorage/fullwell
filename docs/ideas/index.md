# Ideation Index

`docs/ideas/index.md` is the authoritative backlog for work that is being explored, shaped, or queued, but not yet implemented.

Every document under `docs/ideas/backlog/` must appear here.

## Workflow

1. Add new ideas here first, even if they begin as a one-line seed.
2. Expand any idea that needs more context into `docs/ideas/backlog/<slug>.md`.
3. Keep the table sorted by `Priority lane`, then by how ready the idea is to promote.
4. Move implementation detail into an ExecPlan only when the work is actually being started.

## Priority lanes

- `now` — best candidate for the next implementation cycle
- `next` — important, but not first
- `later` — valuable to preserve, not near-term
- `parked` — intentionally held without active planning pressure

## Backlog

| Priority lane | Status | Impact | Confidence | Effort | Idea | Why now | Doc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `now` | `promoted` | `high` | `high` | `medium` | Conversational first-run Fullwell onboarding | Turns a successful plugin install into an evidence-safe path to the snack and recipe reports that make restocking useful. | [brief](../../docs/ideas/backlog/conversational-fullwell-onboarding.md), [ExecPlan](../../docs/exec-plans/completed/2026-07-21-conversational-fullwell-onboarding.md) |
| `next` | `promoted` | `high` | `medium` | `large` | Local-agent grocery restocking with WhatsApp gateway | Converts local journal history into a low-friction cart action while keeping the server limited to direct, no-middleware message relay. | [brief](../../docs/ideas/backlog/evidence-backed-grocery-restocking.md), [ExecPlan](../../docs/exec-plans/active/2026-07-20-whatsapp-local-restocking.md) |
