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
| `now` | `promoted` | `high` | `high` | `medium` | Agent guides and visual journal browsing | Makes the website a useful handoff from chat with task-specific guidance and image-forward, progressively loaded views of the household's existing recipe and grocery records. | [brief](../../docs/ideas/backlog/agent-guides-and-visual-journal-browsing.md), [completed ExecPlan](../../docs/exec-plans/completed/2026-07-24-agent-guides-and-visual-journal-browsing.md) |
| `now` | `promoted` | `high` | `high` | `medium` | Conversational first-run Fullwell onboarding | Turns a successful plugin install into a remembered, name-first path to useful local and cloud household workflows. | [brief](../../docs/ideas/backlog/conversational-fullwell-onboarding.md), [ExecPlan](../../docs/exec-plans/completed/2026-07-21-conversational-fullwell-onboarding.md) |
| `next` | `promoted` | `high` | `medium` | `large` | Local-agent grocery restocking with WhatsApp gateway | Converts local journal history into a low-friction cart action with a configurable automatic-add maximum while keeping the server limited to direct, no-middleware message relay. | [brief](../../docs/ideas/backlog/evidence-backed-grocery-restocking.md), [ExecPlan](../../docs/exec-plans/active/2026-07-20-whatsapp-local-restocking.md) |
| `next` | `promoted` | `high` | `high` | `large` | Collaborative household meal planning | Gives a household one weekly planning surface where concurrent suggestions accumulate, a personal host task can start the conversation, liked recipes and optional web research stay provenance-aware, constraints are confirmed, and a login-free local visual board supplements chat. | [brief](../../docs/ideas/backlog/collaborative-household-meal-planning.md), [completed ExecPlan](../../docs/exec-plans/completed/2026-07-23-collaborative-household-meal-planning.md) |
| `next` | `promoted` | `high` | `medium` | `large` | Household food-delivery history and cart preparation | Extends Fullwell's evidence-backed food memory to restaurant locations and dishes, then reuses computer-use safety boundaries to prepare a prior order without checkout. | [brief](../../docs/ideas/backlog/food-delivery-history-and-cart-preparation.md), [ExecPlan](../../docs/exec-plans/active/2026-07-24-food-delivery-history-and-cart-preparation.md) |
