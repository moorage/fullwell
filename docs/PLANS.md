# Codex Execution Plans (ExecPlans)

This document defines the standard for execution plans in this repository.

An ExecPlan is a living design-and-implementation artifact that a coding agent can use to deliver a working change with no hidden context.

Plans in this repository should be self-contained, novice-guiding, and outcome-focused. A working agent should be able to restart from the current working tree plus the single ExecPlan file without relying on hidden chat context or undocumented assumptions.

## What is not an ExecPlan

Use `docs/ideas/` for exploratory backlog items, prioritization, and fuller idea briefs that are intentionally not being implemented yet.

Promote an idea into `docs/exec-plans/active/` when:
- the work is accepted for implementation
- the scope needs milestones, verification commands, and execution history
- the idea has moved past shaping and into delivery

## When an ExecPlan is required

Use an ExecPlan when any of the following is true:
- work spans multiple files or modules
- a design choice or migration is involved
- there are unknowns to investigate
- a change affects reliability, security, OAuth, Git consistency, household authorization, public sharing, LLM semantic behavior, evals, or user-visible behavior
- expected work exceeds ~30 minutes
- there is likely to be more than one PR or more than one major milestone

For small bug fixes, typo fixes, or tightly local changes, an ExecPlan is optional.

## Recommended framing step

Before decomposing non-trivial work into milestones, use
`.agents/skills/expert-roundtable/SKILL.md` when the request benefits from
multiple expert lenses, especially for:
- user-facing feature work
- messaging, permissions, or trust-sensitive workflows
- agentic features involving model behavior, prompts, or evals
- architecture changes with operational consequences

The output should be a concise synthesis memo, not a long transcript. Use that
memo to shape:
- the problem framing in `Purpose / Big Picture`
- the constraints and prior art in `Context and Orientation`
- the key tradeoffs in `Decision Log`
- the sequencing and risk handling in `Milestones`

Do not use this step for trivial bug fixes or narrow mechanical edits.

## Required critique gate

After an ExecPlan is drafted and before implementation starts, use
`.agents/skills/feature-critic/SKILL.md` for:
- new medium-size or large product features
- large software changes beyond tightly local polish (for example, not a button resize)

Apply the plan changes it requires before coding.

## Where plans live

- active plans: `docs/exec-plans/active/`
- completed plans: `docs/exec-plans/completed/`

Related pre-implementation space:
- idea backlog and prioritization: `docs/ideas/`

## Naming
Use:
`YYYY-MM-DD-short-kebab-name.md`

Example:
`2026-03-08-race-condition-hardening.md`

## Required sections

Every ExecPlan must include:

1. `# Title`
2. `## Purpose / Big Picture`
3. `## Progress`
4. `## Surprises & Discoveries`
5. `## Decision Log`
6. `## Context and Orientation`
7. `## Milestones`
8. `## Acceptance / Verification`
9. `## Outcomes & Retrospective`

## Authoring rules

- Treat the reader as a complete beginner to this repository
- Include exact repo-relative paths
- Include exact commands
- Embed essential implementation context in the plan itself
- State assumptions explicitly
- Resolve ambiguity where possible instead of punting
- Prefer proving feasibility early with a narrow prototype when unknowns are high
- Define non-obvious terms in plain language where they first appear
- Keep milestones independently verifiable and describe the observable result of each one
- For Git mutation changes, name the exact durable mutation and idempotency state transitions affected
- For household, invitation, collection, or import changes, state how authorization races, retries, conflicts, and final-owner protection are handled

For larger migrations or trust-sensitive work, also prefer:
- explicit rollback or recovery notes
- exact acceptance evidence, not just internal code-shape claims
- enough context that a stateless agent can continue without re-reading prior chats

## Maintenance rules

The working agent must:
- update `Progress` at each meaningful stopping point
- use timestamps in `Progress` entries whenever practical so implementation history is reconstructable
- append discoveries as soon as they are learned
- log decisions with date and rationale
- update acceptance criteria if scope changes
- proceed to the next milestone without asking the user for generic "next steps" when the plan already makes the sequence clear
- move the plan to `completed/` when done

A plan is stale if:
- its referenced files no longer exist
- progress has not been updated after substantive implementation
- it no longer describes the current intended architecture
- acceptance commands no longer run

## Plan skeleton

```md
# <Title>

## Purpose / Big Picture
Describe the user or system problem, the intended outcome, and why this matters.

## Progress
- [ ] Milestone 1
- [ ] Milestone 2
- [ ] Milestone 3

## Surprises & Discoveries
- YYYY-MM-DD: discovery and why it matters

## Decision Log
- YYYY-MM-DD: decision, rationale, alternatives considered

## Context and Orientation
Relevant modules, file paths, current behavior, constraints, prior art.

## Milestones

### Milestone 1 — <name>
Files:
- `path/to/file`

Tasks:
1. ...
2. ...

Verification:
- `npm run ...`

### Milestone 2 — <name>
...

## Acceptance / Verification
- user-visible acceptance criteria
- test commands
- metrics/logs to inspect
- rollback notes if relevant

## Outcomes & Retrospective
What changed, what risks remain, what to do next.
```

## Automatic maintenance

`npm run verify:docs` should fail if any active plan:
- lacks required sections
- has empty `Progress`
- references nonexistent files
- omits commands in Acceptance / Verification

`npm run verify:execplan` is the direct validator for active plans in `docs/exec-plans/active/`.

Recommended extra sections for larger or riskier plans:
- `## Idempotence and Recovery`
- `## Artifacts and Notes`
- `## Interfaces and Dependencies`
- `## Framing Notes` for preserving a concise pre-plan synthesis when it
  materially improves restartability

These sections are not mandatory for every plan in the current repo, but they are encouraged when they materially improve restartability or safe implementation.
