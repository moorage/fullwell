# Weekly Meal-Planning Automation

The recurring reminder belongs only to the Codex or Claude host. Fullwell stores no scheduler receipt, cron row, calendar event, launchd job, worker, notification record, or reminder state in the journal, Git, Neon, local files, or cloud exports.

## Stable identity and prompt

Use exactly one native task named:

`Fullwell weekly meal planning`

The bounded Codex task instruction is:

`$plan-household-meals`

`Start this week's Fullwell meal-planning check-in. Load current meal-planning state, confirm whether allergies or food sensitivities changed, and ask whether the user wants liked recipes, new web research, or both. Do not search, create proposals, change constraints, or render a board until the user answers.`

Every Codex native task prompt includes both lines, including a task attached to the current chat. Schedule the current chat when that preserves the required Fullwell context; otherwise create a new native task with the same prompt. For a local-only Claude household, use a Claude Code Desktop local task that can reach the Fullwell directory and explicitly direct it to the `plan-household-meals` skill before the bounded instruction. A remote Claude task is eligible only for an authenticated cloud household it can access without copying local journal content.

The task name and prompt contain no household title, member identity, recipe, constraint, URL, query, credential, or conversation transcript.

## Creation and reconciliation

At the end of successful setup or onboarding:

1. inspect the host's native task list for the exact stable name;
2. if none exists, offer: "I can check in each week to plan meals. Sunday at 9:00 AM in <confirmed time zone> is the default. Want that, a different day and time, or no reminder?";
3. create nothing after a decline, silence, vague non-default time, or unconfirmed time zone;
4. echo the exact recurring weekday, clock time, and IANA time zone before applying;
5. create or update only through the documented native host flow;
6. list again or use the host's confirmed result and report success only when the exact resulting task and schedule are confirmed.

If multiple exact-name tasks exist, show the duplicates and repair to one before creating or updating. If listing, creation, or update times out or has an unknown result, list again and reconcile; never create another while state is unknown. A draft, instruction, UI appearance, or prefilled action is not success.

An explicit "Sunday morning is fine" selects Sunday at 9:00 AM. For another vague part of day, ask for a clock time. Preserve local wall-clock time across daylight-saving transitions. When the detected time zone differs from the confirmed task zone, show both and ask before rescheduling.

## Conversational lifecycle

Support these requests against native host state:

- show the current schedule;
- change the recurring weekday, time, or time zone;
- pause and resume;
- remove;
- skip only this week;
- defer one occurrence to an exact later date and time.

When "move it to Tuesday" could mean one occurrence or the recurrence, ask: "Just this week, or every week?" A permanent change edits the one exact task. A skip or deferral uses a documented native one-occurrence control and leaves the recurrence intact. If the current surface cannot perform that control, provide the exact supported handoff and wait for a confirmed host result.

Interpret "stop", "turn off", "remove", and "cancel the weekly reminder" as permanent removal of the exact `Fullwell weekly meal planning` task. Interpret "pause" as retaining that task in a paused state. List before acting, reconcile duplicate exact-name tasks, remove every duplicate for a permanent stop, and list again or rely on a confirmed host result before saying the reminder stopped.

Codex and Claude task state is personal to one user and host installation. Two household members may each opt in; neither changes the other's task or writes shared reminder state.

## Run behavior

At run time, resolve the current Monday-start week in the confirmed time zone and read current planning state. If the week already has a current constraints review or proposals, give a concise status check rather than duplicating writes.

Begin with:

`Ready to plan meals for the week of <date>? I can start with recipes you've liked, look for new ones, or mix both. Before I recommend anything, have the household's allergies or food sensitivities changed?`

Then wait. The scheduled task itself grants no authority to search, alter constraints, add or withdraw proposals, or create/open a visual board.

Missed local runs do not create a backlog. When the host documents that sleeping, offline, closed, or unavailable time skips a run, allow at most one later catch-up while the week is still useful and only when no check-in or current weekly review already exists.

## Failure and removal

If native task management is unavailable, report that limitation and present the exact stable name, bounded instruction, and requested schedule for the supported host handoff. Do not simulate UI, use OS automation, or claim the reminder exists.

Before uninstalling or rolling back creation guidance, pause or remove the native task through its host. If the result is unknown, say host confirmation is still required. Fullwell cannot guarantee a run while the selected host, device, project context, or local data is unavailable.
