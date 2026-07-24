# Weekly Meal-Planning Automation

Status: implemented in the shared Codex/Claude agent package.

## Product intent

The reminder feels like Fullwell returning to the same conversation, but it is intentionally not a background meal planner. It opens a check-in, establishes the current week, asks whether food constraints changed and which recipe source the user wants, then waits. It never searches, changes constraints, adds proposals, or renders a board from schedule authority alone.

The stable native task name is `Fullwell weekly meal planning`. Sunday at 9:00 AM in the confirmed household IANA time zone is the offered default. The user may choose another exact weekday and time, decline without affecting setup completion, or manage the task later in ordinary language.

## Host capability boundary

| Surface | Supported authority | Local data | Availability behavior | Fullwell behavior |
|---|---|---|---|---|
| Codex scheduled tasks | Native task created or updated conversationally; prefer the current chat and always invoke `$plan-household-meals` in its prompt | Available only when the scheduled project/chat can reach the installed local tool | Host controls run timing and availability | List, reconcile the stable name, echo exact cadence, and trust only confirmed host state |
| Claude Code Desktop local tasks | Native local recurring task | Eligible for a local-only household when the selected directory and plugin are available | Desktop app and computer availability apply; missed local runs are not a queue | Use for local data; allow at most one useful catch-up |
| Claude remote/Cowork tasks | Native remote recurring task | Not eligible for a local-only journal | Remote host semantics apply | Eligible only for an authenticated Fullwell cloud household |
| CLI or surface without native task management | No scheduler authority | Unchanged | No run occurs | Show the stable name, fixed instruction, and exact requested schedule as a handoff; wait for confirmation |

Fullwell implements no MCP scheduler, server worker, database row, cron, launchd job, calendar event, email, WhatsApp message, or push fallback.

Capability evidence is maintained against the official [Codex scheduled-tasks documentation](https://developers.openai.com/codex/app/automations), [Claude Desktop scheduled-tasks documentation](https://code.claude.com/docs/en/desktop-scheduled-tasks), and [Claude Cowork recurring-task documentation](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork). Documentation establishes the supported host lifecycle; release evidence still verifies the installed host surface before claiming a task exists.

## Creation flow

1. Successful setup completes independently.
2. The agent lists native tasks and reconciles the exact stable name.
3. When none exists, it offers Sunday at 9:00 AM in the confirmed zone, another day/time, or no reminder.
4. A vague non-default time prompts for a clock time. `Sunday morning is fine` resolves to the documented 9:00 AM default.
5. The agent echoes exact recurring weekday, time, and zone.
6. After confirmation, it uses the native host action once.
7. It lists again or uses a definitive host response and reports only the confirmed result.

Duplicate exact-name tasks are a repair state, not permission to create another. A timeout or unknown create result triggers relisting and reconciliation.

## Scheduled instruction

For every Codex task, including one attached to the current chat, `$plan-household-meals` precedes this bounded instruction:

> Start this week's Fullwell meal-planning check-in. Load current meal-planning state, confirm whether allergies or food sensitivities changed, and ask whether the user wants liked recipes, new web research, or both. Do not search, create proposals, change constraints, or render a board until the user answers.

The name and prompt contain no household title, member identity, recipe, constraint, URL, query, credential, or transcript.

## Run and deduplication

The run resolves the Monday-start week in the confirmed zone and loads current local or cloud state. It starts with:

> Ready to plan meals for the week of <date>? I can start with recipes you've liked, look for new ones, or mix both. Before I recommend anything, have the household's allergies or food sensitivities changed?

It then waits. If the current week already has a valid constraint review or proposals, it gives a concise status check rather than duplicating shared writes. Two cloud members may keep two personal host tasks; shared idempotency and current-week inspection prevent duplicate proposals.

## Lifecycle and calendar behavior

The same skill supports schedule inspection, permanent cadence changes, pause, resume, removal, one-week skip, and one-time deferral. Ambiguous requests use `Just this week, or every week?`

The task preserves the same local wall-clock time across daylight-saving transitions. If the detected zone differs from the confirmed task zone, the agent shows both before rescheduling. Missed local runs create no backlog; at most one catch-up remains eligible while the week is useful and only if no prompt or current review exists.

## Failure and rollback

A rendered draft, prefilled action, timeout, or unknown result is not success. Unsupported native lifecycle operations become explicit host handoffs.

Before rollback or uninstall removes creation guidance, the native task is paused or removed. If host confirmation is unavailable, the product reports the remaining host-owned task and required cleanup; it never claims deletion. Fullwell cannot guarantee a run while the selected host, device, app, project context, or authorized data is unavailable.
