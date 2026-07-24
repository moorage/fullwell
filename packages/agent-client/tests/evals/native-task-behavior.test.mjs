import assert from "node:assert/strict";
import test from "node:test";

const TASK_NAME = "Fullwell weekly meal planning";
const CODEX_SKILL_INVOCATION = "$plan-household-meals";
const BOUNDED_INSTRUCTION =
  "Start this week's Fullwell meal-planning check-in. Load current meal-planning state, confirm whether allergies or food sensitivities changed, and ask whether the user wants liked recipes, new web research, or both. Do not search, create proposals, change constraints, or render a board until the user answers.";

const defaultSchedule = {
  weekday: "Sunday",
  time: "09:00",
  time_zone: "America/Los_Angeles",
};

function promptFor(host) {
  if (host === "codex") return `${CODEX_SKILL_INVOCATION}\n${BOUNDED_INSTRUCTION}`;
  return `Use the plan-household-meals skill.\n${BOUNDED_INSTRUCTION}`;
}

class NativeTaskHost {
  constructor(host) {
    this.host = host;
    this.tasks = [];
    this.events = [];
    this.nextId = 1;
  }

  list() {
    this.events.push({ operation: "list" });
    return this.tasks.filter((task) => task.name === TASK_NAME).map((task) => structuredClone(task));
  }

  create(schedule, outcome = "confirmed") {
    this.events.push({ operation: "create", schedule: structuredClone(schedule) });
    if (outcome !== "unknown_without_commit") {
      this.tasks.push({
        id: `${this.host}-${this.nextId++}`,
        name: TASK_NAME,
        prompt: promptFor(this.host),
        schedule: structuredClone(schedule),
        state: "active",
        skipped: [],
        deferred: [],
      });
    }
    return outcome === "confirmed" ? { status: "confirmed" } : { status: "unknown" };
  }

  update(id, schedule) {
    this.events.push({ operation: "update", id, schedule: structuredClone(schedule) });
    const task = this.tasks.find((candidate) => candidate.id === id);
    task.schedule = structuredClone(schedule);
    return { status: "confirmed" };
  }

  remove(id) {
    this.events.push({ operation: "remove", id });
    this.tasks = this.tasks.filter((task) => task.id !== id);
    return { status: "confirmed" };
  }

  setState(id, state) {
    this.events.push({ operation: state, id });
    this.tasks.find((task) => task.id === id).state = state === "pause" ? "paused" : "active";
    return { status: "confirmed" };
  }

  skip(id, localDate) {
    this.events.push({ operation: "skip", id, localDate });
    this.tasks.find((task) => task.id === id).skipped.push(localDate);
    return { status: "confirmed" };
  }

  defer(id, fromLocalDate, toLocalDateTime) {
    this.events.push({ operation: "defer", id, fromLocalDate, toLocalDateTime });
    this.tasks.find((task) => task.id === id).deferred.push({ fromLocalDate, toLocalDateTime });
    return { status: "confirmed" };
  }
}

function sameSchedule(left, right) {
  return left.weekday === right.weekday &&
    left.time === right.time &&
    left.time_zone === right.time_zone;
}

function reconcileSchedule(host, requested, createOutcome = "confirmed") {
  const before = host.list();
  if (before.length > 1) {
    for (const duplicate of before.slice(1)) host.remove(duplicate.id);
  }
  const current = before[0];
  if (current && sameSchedule(current.schedule, requested)) {
    return { status: "confirmed", source: "existing", task: current };
  }
  if (current) {
    host.update(current.id, requested);
    return { status: "confirmed", source: "updated", task: host.list()[0] };
  }

  const created = host.create(requested, createOutcome);
  if (created.status === "confirmed") {
    return { status: "confirmed", source: "created", task: host.list()[0] };
  }
  const afterUnknown = host.list();
  if (afterUnknown.length === 1 && sameSchedule(afterUnknown[0].schedule, requested)) {
    return { status: "confirmed", source: "reconciled", task: afterUnknown[0] };
  }
  return { status: "unconfirmed", source: "unknown" };
}

function runScheduledCheckIn({ alreadyPrompted = false, currentReview = false, proposals = 0 } = {}) {
  if (alreadyPrompted || currentReview || proposals > 0) {
    return { action: "status", writes: 0, searches: 0, boards: 0 };
  }
  return {
    action: "ask",
    message:
      "Ready to plan meals for the week of 2027-03-08? I can start with recipes you've liked, look for new ones, or mix both. Before I recommend anything, have the household's allergies or food sensitivities changed?",
    writes: 0,
    searches: 0,
    boards: 0,
  };
}

function resolveScheduleChange({
  recurring,
  exactTime,
  scope,
  confirmedTimeZone,
  detectedTimeZone,
  acceptDetectedTimeZone = false,
}) {
  if (!exactTime) return { status: "needs_exact_time" };
  if (!scope) return { status: "needs_scope", question: "Just this week, or every week?" };
  if (confirmedTimeZone !== detectedTimeZone && !acceptDetectedTimeZone) {
    return {
      status: "needs_time_zone_confirmation",
      confirmedTimeZone,
      detectedTimeZone,
    };
  }
  return {
    status: "confirmed",
    scope,
    schedule: {
      ...recurring,
      time: exactTime,
      time_zone: acceptDetectedTimeZone ? detectedTimeZone : confirmedTimeZone,
    },
  };
}

function catchUpCount({ missedRuns, weekUseful = true, alreadyPrompted = false, currentReview = false }) {
  if (!weekUseful || alreadyPrompted || currentReview) return 0;
  return Math.min(missedRuns, 1);
}

function selectTaskMode({ host, householdMode, localContextAvailable, remoteCloudAvailable }) {
  if (householdMode === "local") {
    if (!localContextAvailable) return "unavailable";
    return host === "claude" ? "local_desktop" : "current_project";
  }
  if (remoteCloudAvailable) return host === "claude" ? "remote_cloud" : "current_or_new_chat";
  if (localContextAvailable) return host === "claude" ? "local_desktop" : "current_project";
  return "unavailable";
}

function cleanUpNativeTask(host, { hostAvailable }) {
  if (!hostAvailable) {
    return {
      status: "needs_host_confirmation",
      remainingTask: TASK_NAME,
      requiredAction: `Open ${host.host} native tasks and pause or remove ${TASK_NAME}.`,
    };
  }
  const tasks = host.list();
  for (const task of tasks) host.remove(task.id);
  return { status: "confirmed", remainingTask: null, requiredAction: null };
}

function applyReminderControl(host, request) {
  const tasks = host.list();
  if (request === "pause") {
    for (const task of tasks) host.setState(task.id, "pause");
    return { status: "confirmed", action: "paused" };
  }
  for (const task of tasks) host.remove(task.id);
  return { status: "confirmed", action: "removed" };
}

function attemptNativeTaskRun(host, { hostAvailable, requiredContextAvailable }) {
  const task = host.list()[0];
  if (task === undefined) return { status: "missing", runGuaranteed: false, handoff: null };
  if (!hostAvailable || !requiredContextAvailable) {
    return {
      status: "unavailable",
      runGuaranteed: false,
      handoff: `Open ${host.host} native tasks and run ${TASK_NAME} after its required project and data are available.`,
      taskId: task.id,
    };
  }
  return {
    status: "started",
    runGuaranteed: true,
    handoff: null,
    taskId: task.id,
  };
}

function visualBoardHandoff({ recommendationsShown, accepted, openConfirmed }) {
  if (!recommendationsShown) return { create: false, open: false, status: "not_offered" };
  if (!accepted) return { create: false, open: false, status: "offered" };
  return {
    create: true,
    open: true,
    status: openConfirmed ? "opened" : "created_unconfirmed",
  };
}

function localClock(instant, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

for (const hostName of ["codex", "claude"]) {
  test(`${hostName} treats stop as removal while pause preserves the native task`, () => {
    const host = new NativeTaskHost(hostName);
    host.create(defaultSchedule);
    host.create(defaultSchedule);
    assert.equal(applyReminderControl(host, "stop").action, "removed");
    assert.equal(host.list().length, 0);

    host.create(defaultSchedule);
    assert.equal(applyReminderControl(host, "pause").action, "paused");
    assert.equal(host.list()[0].state, "paused");
  });

  test(`${hostName} native task contract executes the complete confirmed lifecycle`, () => {
    const host = new NativeTaskHost(hostName);
    const created = reconcileSchedule(host, defaultSchedule);
    assert.equal(created.source, "created");
    assert.equal(host.tasks.length, 1);
    assert.match(created.task.prompt, /plan-household-meals/);
    assert.match(created.task.prompt, /Do not search, create proposals, change constraints, or render a board/);
    if (hostName === "codex") assert.ok(created.task.prompt.startsWith(CODEX_SKILL_INVOCATION));

    const replayed = reconcileSchedule(host, defaultSchedule);
    assert.equal(replayed.source, "existing");
    assert.equal(host.events.filter((event) => event.operation === "create").length, 1);

    const customSchedule = {
      weekday: "Wednesday",
      time: "18:30",
      time_zone: "America/New_York",
    };
    const updated = reconcileSchedule(host, customSchedule);
    assert.equal(updated.source, "updated");
    assert.deepEqual(host.tasks[0].schedule, customSchedule);

    host.setState(host.tasks[0].id, "pause");
    assert.equal(host.tasks[0].state, "paused");
    host.setState(host.tasks[0].id, "resume");
    assert.equal(host.tasks[0].state, "active");
    host.skip(host.tasks[0].id, "2027-03-14");
    host.defer(host.tasks[0].id, "2027-03-21", "2027-03-22T19:00:00");
    assert.deepEqual(host.tasks[0].schedule, customSchedule);
    assert.deepEqual(host.tasks[0].skipped, ["2027-03-14"]);
    assert.deepEqual(host.tasks[0].deferred, [{
      fromLocalDate: "2027-03-21",
      toLocalDateTime: "2027-03-22T19:00:00",
    }]);

    host.remove(host.tasks[0].id);
    assert.equal(host.list().length, 0);
  });

  test(`${hostName} reconciles duplicate and unknown native task results`, () => {
    const committedUnknown = new NativeTaskHost(hostName);
    const reconciled = reconcileSchedule(committedUnknown, defaultSchedule, "unknown_after_commit");
    assert.equal(reconciled.source, "reconciled");
    assert.equal(committedUnknown.tasks.length, 1);
    assert.equal(committedUnknown.events.filter((event) => event.operation === "create").length, 1);

    const uncommittedUnknown = new NativeTaskHost(hostName);
    const unresolved = reconcileSchedule(uncommittedUnknown, defaultSchedule, "unknown_without_commit");
    assert.equal(unresolved.status, "unconfirmed");
    assert.equal(uncommittedUnknown.events.filter((event) => event.operation === "create").length, 1);

    const duplicates = new NativeTaskHost(hostName);
    duplicates.create(defaultSchedule);
    duplicates.create(defaultSchedule);
    const repaired = reconcileSchedule(duplicates, defaultSchedule);
    assert.equal(repaired.status, "confirmed");
    assert.equal(duplicates.tasks.length, 1);
    assert.equal(duplicates.events.filter((event) => event.operation === "remove").length, 1);
    assert.equal(duplicates.events.filter((event) => event.operation === "create").length, 2);
  });
}

test("scheduled behavior preserves wall-clock time and prevents backlog work", () => {
  assert.equal(localClock("2027-03-14T16:00:00.000Z", "America/Los_Angeles"), "09:00");
  assert.equal(localClock("2027-11-07T17:00:00.000Z", "America/Los_Angeles"), "09:00");

  const firstRun = runScheduledCheckIn();
  assert.equal(firstRun.action, "ask");
  assert.equal(firstRun.writes + firstRun.searches + firstRun.boards, 0);
  assert.match(firstRun.message, /have the household's allergies or food sensitivities changed\?/);

  for (const existingState of [
    { alreadyPrompted: true },
    { currentReview: true },
    { proposals: 2 },
  ]) {
    assert.deepEqual(runScheduledCheckIn(existingState), {
      action: "status",
      writes: 0,
      searches: 0,
      boards: 0,
    });
  }
});

test("schedule changes wait for exact scope, time, and time-zone confirmation", () => {
  assert.deepEqual(resolveScheduleChange({
    recurring: defaultSchedule,
    exactTime: null,
    scope: "recurring",
    confirmedTimeZone: "America/Los_Angeles",
    detectedTimeZone: "America/Los_Angeles",
  }), { status: "needs_exact_time" });

  assert.deepEqual(resolveScheduleChange({
    recurring: defaultSchedule,
    exactTime: "19:00",
    scope: null,
    confirmedTimeZone: "America/Los_Angeles",
    detectedTimeZone: "America/Los_Angeles",
  }), { status: "needs_scope", question: "Just this week, or every week?" });

  const zoneChange = resolveScheduleChange({
    recurring: defaultSchedule,
    exactTime: "09:00",
    scope: "recurring",
    confirmedTimeZone: "America/Los_Angeles",
    detectedTimeZone: "America/New_York",
  });
  assert.deepEqual(zoneChange, {
    status: "needs_time_zone_confirmation",
    confirmedTimeZone: "America/Los_Angeles",
    detectedTimeZone: "America/New_York",
  });
  assert.deepEqual(resolveScheduleChange({
    recurring: defaultSchedule,
    exactTime: "09:00",
    scope: "recurring",
    confirmedTimeZone: "America/Los_Angeles",
    detectedTimeZone: "America/New_York",
    acceptDetectedTimeZone: true,
  }), {
    status: "confirmed",
    scope: "recurring",
    schedule: {
      weekday: "Sunday",
      time: "09:00",
      time_zone: "America/New_York",
    },
  });
});

test("missed runs, member schedules, local data, and visual handoff stay bounded", () => {
  assert.equal(catchUpCount({ missedRuns: 3 }), 1);
  assert.equal(catchUpCount({ missedRuns: 3, alreadyPrompted: true }), 0);
  assert.equal(catchUpCount({ missedRuns: 3, currentReview: true }), 0);
  assert.equal(catchUpCount({ missedRuns: 3, weekUseful: false }), 0);

  const firstMember = new NativeTaskHost("codex");
  const secondMember = new NativeTaskHost("codex");
  reconcileSchedule(firstMember, defaultSchedule);
  reconcileSchedule(secondMember, {
    ...defaultSchedule,
    weekday: "Wednesday",
  });
  assert.equal(firstMember.tasks.length, 1);
  assert.equal(secondMember.tasks.length, 1);
  assert.equal(firstMember.tasks[0].schedule.weekday, "Sunday");
  assert.equal(secondMember.tasks[0].schedule.weekday, "Wednesday");

  assert.equal(selectTaskMode({
    host: "claude",
    householdMode: "local",
    localContextAvailable: true,
    remoteCloudAvailable: true,
  }), "local_desktop");
  assert.equal(selectTaskMode({
    host: "claude",
    householdMode: "local",
    localContextAvailable: false,
    remoteCloudAvailable: true,
  }), "unavailable");
  assert.equal(selectTaskMode({
    host: "claude",
    householdMode: "cloud",
    localContextAvailable: false,
    remoteCloudAvailable: true,
  }), "remote_cloud");
  assert.equal(selectTaskMode({
    host: "codex",
    householdMode: "local",
    localContextAvailable: true,
    remoteCloudAvailable: false,
  }), "current_project");
  assert.equal(selectTaskMode({
    host: "codex",
    householdMode: "local",
    localContextAvailable: false,
    remoteCloudAvailable: true,
  }), "unavailable");
  assert.equal(selectTaskMode({
    host: "codex",
    householdMode: "cloud",
    localContextAvailable: false,
    remoteCloudAvailable: true,
  }), "current_or_new_chat");

  assert.deepEqual(visualBoardHandoff({
    recommendationsShown: false,
    accepted: true,
    openConfirmed: true,
  }), { create: false, open: false, status: "not_offered" });
  assert.deepEqual(visualBoardHandoff({
    recommendationsShown: true,
    accepted: false,
    openConfirmed: false,
  }), { create: false, open: false, status: "offered" });
  assert.deepEqual(visualBoardHandoff({
    recommendationsShown: true,
    accepted: true,
    openConfirmed: false,
  }), { create: true, open: true, status: "created_unconfirmed" });
  assert.deepEqual(visualBoardHandoff({
    recommendationsShown: true,
    accepted: true,
    openConfirmed: true,
  }), { create: true, open: true, status: "opened" });
});

for (const hostName of ["codex", "claude"]) {
  test(`${hostName} preserves an active task and rejects run guarantees while unavailable`, () => {
    const host = new NativeTaskHost(hostName);
    reconcileSchedule(host, defaultSchedule);
    const result = attemptNativeTaskRun(host, {
      hostAvailable: false,
      requiredContextAvailable: false,
    });
    assert.equal(result.status, "unavailable");
    assert.equal(result.runGuaranteed, false);
    assert.match(result.handoff, new RegExp(`Open ${hostName} native tasks`));
    assert.match(result.handoff, new RegExp(TASK_NAME));
    assert.equal(host.tasks.length, 1);
    assert.equal(host.tasks[0].state, "active");
    assert.equal(host.events.filter((event) => event.operation === "remove").length, 0);
  });

  test(`${hostName} rollback cleanup requires a confirmed native task result`, () => {
    const availableHost = new NativeTaskHost(hostName);
    reconcileSchedule(availableHost, defaultSchedule);
    assert.deepEqual(cleanUpNativeTask(availableHost, { hostAvailable: true }), {
      status: "confirmed",
      remainingTask: null,
      requiredAction: null,
    });
    assert.equal(availableHost.tasks.length, 0);

    const unavailableHost = new NativeTaskHost(hostName);
    reconcileSchedule(unavailableHost, defaultSchedule);
    const unresolved = cleanUpNativeTask(unavailableHost, { hostAvailable: false });
    assert.equal(unresolved.status, "needs_host_confirmation");
    assert.equal(unresolved.remainingTask, TASK_NAME);
    assert.match(unresolved.requiredAction, new RegExp(hostName));
    assert.equal(unavailableHost.tasks.length, 1);
    assert.equal(unavailableHost.events.filter((event) => event.operation === "remove").length, 0);
  });
}
