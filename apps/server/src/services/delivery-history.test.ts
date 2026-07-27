import {
  ActorIdSchema,
  DeliveryOrderGroupLocatorSchema,
  DeliveryOrderLineKeySchema,
  DeliveryToolOutputSchemas,
  EvidenceIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  ItemIdSchema,
  ProviderMenuItemLocatorSchema,
  ProviderMerchantLocatorSchema,
  ProviderOrderLocatorSchema,
  ProviderOriginSchema,
  RequestIdSchema,
  UserIdSchema,
  type ActorId,
  type DeliveryDishItem,
  type DeliveryIndexReport,
  type DeliveryOrderLineEvidence,
  type DeliveryProfile,
  type GitObjectId,
  type HouseholdId,
  type ProviderOrigin,
} from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import type { JsonValue, Principal } from "../core/types.js";
import { deliveryProfilePath, markdownDocument } from "../domain/journal-validation.js";
import { HouseholdFoodJournalService } from "./household-food-journal.js";

const owner: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000401"),
  actorId: ActorIdSchema.parse("act_0000000000000401"),
  displayName: "Delivery Owner",
  scopes: new Set(["journal:read", "journal:write", "household:manage"]),
  client: "test",
};
const editor: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000402"),
  actorId: ActorIdSchema.parse("act_0000000000000402"),
  displayName: "Delivery Editor",
  scopes: owner.scopes,
  client: "test",
};
const viewer: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000403"),
  actorId: ActorIdSchema.parse("act_0000000000000403"),
  displayName: "Delivery Viewer",
  scopes: new Set(["journal:read"]),
  client: "test",
};
const outsider: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000404"),
  actorId: ActorIdSchema.parse("act_0000000000000404"),
  displayName: "Outsider",
  scopes: owner.scopes,
  client: "test",
};

describe("connected delivery history tools", () => {
  it("commits, pages, reads, authorizes, and replays one complete provider history", async () => {
    const context = await serviceContext();
    const bundle = deliveryBundle(410, "https://delivery.example", "DoorDash", owner.actorId, 2);
    const nextProfile = profileDocument([bundle]);
    const nextReport = aggregateReport([bundle]);
    const input = commitInput(context.householdId, context.head, bundle, {
      nextProfile,
      nextReport,
    });

    const committed = await successful(context.service, "hfj_commit_delivery_index", input, owner);
    expect(committed.data).toMatchObject({
      status: "completed",
      mode: "connected_audit_checkpoint",
      provider_origin: bundle.origin,
      evidence_ids: bundle.evidence.map(({ id }) => id),
      item_ids: bundle.items.map(({ id }) => id),
    });
    expect(context.repository.commitCount(context.householdId)).toBe(1);
    const committedProjection = await context.store.projection(context.householdId);
    expect(committedProjection.items.get(bundle.items[0]!.id)?.item).toMatchObject({
      image_url: "https://images.example.test/delivery-410-0.jpg",
      image_page_url: "https://delivery.example/menu/410/0",
    });

    const firstPage = await successful(context.service, "hfj_search_delivery_history", {
      household_id: context.householdId,
      query: "Wanpo",
      limit: 1,
    }, owner);
    const parsedFirstPage = DeliveryToolOutputSchemas.hfj_search_delivery_history.parse(firstPage.data);
    expect(parsedFirstPage.candidates).toHaveLength(1);
    expect(parsedFirstPage.next_cursor).toBe("v1_1");
    expect(JSON.stringify(firstPage.data)).not.toContain("private-");
    const candidate = parsedFirstPage.candidates[0];
    if (candidate === undefined) throw new Error("delivery candidate missing");
    const secondPage = await successful(context.service, "hfj_search_delivery_history", {
      household_id: context.householdId,
      query: "Wanpo",
      cursor: parsedFirstPage.next_cursor,
      limit: 1,
    }, owner);
    const parsedSecondPage = DeliveryToolOutputSchemas.hfj_search_delivery_history.parse(secondPage.data);
    expect(parsedSecondPage.candidates).toHaveLength(1);
    expect(parsedSecondPage.next_cursor).toBeNull();

    const order = await successful(context.service, "hfj_get_delivery_order", {
      household_id: context.householdId,
      group_handle: candidate.group_handle,
    }, owner);
    expect(DeliveryToolOutputSchemas.hfj_get_delivery_order.parse(order.data).group.lines).toHaveLength(2);
    expect(JSON.stringify(order.data)).toContain("private-order-410");
    const index = await successful(context.service, "hfj_get_delivery_index", {
      household_id: context.householdId,
    }, owner);
    expect(index.data).toMatchObject({ report: nextReport, revision: committed.head });

    await addMember(context.store, context.householdId, viewer, "viewer", committed.head);
    expect(await context.service.call("hfj_search_delivery_history", {
      household_id: context.householdId,
      limit: 1,
    }, viewer)).toMatchObject({ ok: true });
    expect(await context.service.call("hfj_commit_delivery_index", {
      ...input,
      expected_head: committed.head,
      provider_idempotency_key: "viewer-delivery-410",
      expected_delivery_profile_revision: committed.head,
      expected_delivery_report_revision: committed.head,
      expected_profile: nextProfile,
      expected_report: nextReport,
    }, viewer)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await context.service.call("hfj_search_delivery_history", {
      household_id: context.householdId,
      limit: 1,
    }, outsider)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    expect(await successful(context.service, "hfj_commit_delivery_index", input, owner)).toEqual(committed);
    expect(await context.service.call("hfj_commit_delivery_index", {
      ...input,
      next_report: { ...nextReport, markdown: "# Changed replay" },
    }, owner)).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(context.repository.commitCount(context.householdId)).toBe(1);
  });

  it("accepts an editor's unchanged prior provider and rejects cross-provider changes", async () => {
    const context = await serviceContext();
    const first = deliveryBundle(420, "https://first.example", "DoorDash", owner.actorId, 1);
    const firstProfile = profileDocument([first]);
    const firstReport = aggregateReport([first]);
    const firstCommit = await successful(context.service, "hfj_commit_delivery_index", commitInput(
      context.householdId,
      context.head,
      first,
      { nextProfile: firstProfile, nextReport: firstReport },
    ), owner);
    await addMember(context.store, context.householdId, editor, "editor", firstCommit.head);

    const second = deliveryBundle(430, "https://second.example", "Uber Eats", editor.actorId, 1);
    const aggregateProfile = profileDocument([first, second]);
    const aggregate = aggregateReport([first, second]);
    const secondInput = commitInput(context.householdId, firstCommit.head, second, {
      expectedProfile: firstProfile,
      expectedReport: firstReport,
      expectedProfileRevision: firstCommit.head,
      expectedReportRevision: firstCommit.head,
      nextProfile: aggregateProfile,
      nextReport: aggregate,
      mode: "local_promotion",
    });
    const secondCommit = await successful(context.service, "hfj_commit_delivery_index", secondInput, editor);
    expect(secondCommit.data).toMatchObject({ mode: "local_promotion", provider_origin: second.origin });

    const changedSecondProvider = {
      ...aggregateProfile,
      profile: {
        ...aggregateProfile.profile,
        providers: aggregateProfile.profile.providers.map((provider) =>
          provider.provider_origin === second.origin
            ? { ...provider, history_start: "2025-01-01" }
            : provider),
      },
    };
    const providerRejected = await context.service.call("hfj_commit_delivery_index", {
      ...commitInput(context.householdId, secondCommit.head, first, {
        expectedProfile: aggregateProfile,
        expectedReport: aggregate,
        expectedProfileRevision: secondCommit.head,
        expectedReportRevision: secondCommit.head,
        nextProfile: changedSecondProvider,
        nextReport: aggregate,
      }),
      evidence: [],
      items: [],
      provider_idempotency_key: "cross-provider-profile-420",
    }, owner);
    expect(providerRejected).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });

    const changedForeignRow: DeliveryIndexReport = {
      ...aggregate,
      assertions: aggregate.assertions.map((assertion) =>
        assertion.row_id.startsWith("row-430")
          ? { ...assertion, row_id: `${assertion.row_id}-changed` }
          : assertion),
    };
    const reportRejected = await context.service.call("hfj_commit_delivery_index", {
      ...commitInput(context.householdId, secondCommit.head, first, {
        expectedProfile: aggregateProfile,
        expectedReport: aggregate,
        expectedProfileRevision: secondCommit.head,
        expectedReportRevision: secondCommit.head,
        nextProfile: aggregateProfile,
        nextReport: changedForeignRow,
      }),
      evidence: [],
      items: [],
      provider_idempotency_key: "cross-provider-report-420",
    }, owner);
    expect(reportRejected).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });

    const duplicateRowReport: DeliveryIndexReport = {
      ...aggregate,
      assertions: [...aggregate.assertions, aggregate.assertions[0]!],
    };
    const duplicateRowRejected = await context.service.call("hfj_commit_delivery_index", {
      ...commitInput(context.householdId, secondCommit.head, first, {
        expectedProfile: aggregateProfile,
        expectedReport: aggregate,
        expectedProfileRevision: secondCommit.head,
        expectedReportRevision: secondCommit.head,
        nextProfile: aggregateProfile,
        nextReport: duplicateRowReport,
      }),
      evidence: [],
      items: [],
      provider_idempotency_key: "duplicate-report-row-420",
    }, owner);
    expect(duplicateRowRejected).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(context.repository.commitCount(context.householdId)).toBe(2);

    expect(await context.service.call("hfj_commit_delivery_index", {
      ...secondInput,
      provider_idempotency_key: "missing-consent-430",
      household_visibility_confirmed: undefined,
    }, editor)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await context.service.call("hfj_commit_delivery_index", {
      ...secondInput,
      provider_idempotency_key: "false-consent-430",
      household_visibility_confirmed: false,
    }, editor)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await context.service.call("hfj_commit_delivery_index", {
      ...secondInput,
      provider_idempotency_key: "wrong-origin-430",
      evidence: second.evidence.map((entry) => ({
        ...entry,
        delivery_order_line: {
          ...entry.delivery_order_line,
          provider_origin: first.origin,
        },
      })),
    }, editor)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
  });

  it("protects shared report prose when another provider exists only in the canonical profile", async () => {
    const context = await serviceContext();
    const first = deliveryBundle(435, "https://first.example", "DoorDash", owner.actorId, 1);
    const firstProfile = profileDocument([first]);
    const firstReport = aggregateReport([first]);
    const firstCommit = await successful(context.service, "hfj_commit_delivery_index", commitInput(
      context.householdId,
      context.head,
      first,
      { nextProfile: firstProfile, nextReport: firstReport },
    ), owner);

    const profileOnlyProvider = deliveryBundle(436, "https://profile-only.example", "Uber Eats", owner.actorId, 1);
    const sharedProfile = profileDocument([first, profileOnlyProvider]);
    const profileHead = await context.repository.commit(context.householdId, firstCommit.head, [{
      path: deliveryProfilePath(),
      content: markdownDocument(sharedProfile.profile, sharedProfile.markdown),
      appendOnly: false,
    }], {
      requestId: RequestIdSchema.parse("req_0000000000000435"),
      householdId: context.householdId,
      actorId: owner.actorId,
      tool: "hfj_commit_delivery_index",
      client: "test",
      summary: "delivery test",
      occurredAt: "2026-07-15T12:00:00.000Z",
    });
    await context.store.updateHouseholdHead(context.householdId, profileHead);
    const membership = await context.store.getMembership(context.householdId, owner.userId);
    if (membership === null) throw new Error("owner membership missing");
    membership.projectionHead = profileHead;
    await context.store.upsertMembership(membership);

    const baseInput = {
      ...commitInput(context.householdId, profileHead, first, {
        expectedProfile: sharedProfile,
        expectedReport: firstReport,
        expectedProfileRevision: profileHead,
        expectedReportRevision: firstCommit.head,
        nextProfile: sharedProfile,
        nextReport: firstReport,
      }),
      evidence: [],
      items: [],
    };
    expect(await context.service.call("hfj_commit_delivery_index", {
      ...baseInput,
      provider_idempotency_key: "profile-only-provider-changed-prose-435",
      next_report: { ...firstReport, markdown: "# Rewritten Delivery" },
    }, owner)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });

    const unchangedProse = await successful(context.service, "hfj_commit_delivery_index", {
      ...baseInput,
      provider_idempotency_key: "profile-only-provider-unchanged-prose-435",
    }, owner);
    expect(unchangedProse.data).toMatchObject({
      status: "completed",
      provider_origin: first.origin,
    });
    expect(context.repository.commitCount(context.householdId)).toBe(3);
  });

  it("fails closed for incomplete groups and malformed canonical reports", async () => {
    const context = await serviceContext();
    const incomplete = deliveryBundle(440, "https://delivery.example", "DoorDash", owner.actorId, 2);
    (await context.store.projection(context.householdId)).evidence.set(
      incomplete.evidence[0]!.id,
      incomplete.evidence[0]!,
    );
    expect(await context.service.call("hfj_search_delivery_history", {
      household_id: context.householdId,
      limit: 10,
    }, owner)).toMatchObject({ ok: false, error: { code: "PROJECTION_DRIFT" } });

    const badHead = await context.repository.commit(context.householdId, context.head, [{
      path: "delivery/reports/delivery-index.md",
      content: "not frontmatter\n",
      appendOnly: false,
    }], {
      requestId: RequestIdSchema.parse("req_0000000000000440"),
      householdId: context.householdId,
      actorId: owner.actorId,
      tool: "hfj_commit_delivery_index",
      client: "test",
      summary: "delivery test",
      occurredAt: "2026-07-15T12:00:00.000Z",
    });
    await context.store.updateHouseholdHead(context.householdId, badHead);
    const membership = await context.store.getMembership(context.householdId, owner.userId);
    if (membership === null) throw new Error("owner membership missing");
    membership.projectionHead = badHead;
    await context.store.upsertMembership(membership);
    expect(await context.service.call("hfj_get_delivery_index", {
      household_id: context.householdId,
    }, owner)).toMatchObject({ ok: false, error: { code: "PROJECTION_DRIFT" } });
  });

  it("recovers an exact provider commit after projection failure without a second Git commit", async () => {
    const context = await serviceContext();
    const bundle = deliveryBundle(450, "https://delivery.example", "DoorDash", owner.actorId, 1);
    const input = commitInput(context.householdId, context.head, bundle, {
      nextProfile: profileDocument([bundle]),
      nextReport: aggregateReport([bundle]),
    });
    const loadProjection = context.store.projection.bind(context.store);
    let projectionCalls = 0;
    context.store.projection = async (householdId) => {
      projectionCalls += 1;
      if (projectionCalls === 2) throw new Error("simulated delivery projection outage");
      return await loadProjection(householdId);
    };

    expect(await context.service.call("hfj_commit_delivery_index", input, owner)).toMatchObject({
      ok: false,
      error: { code: "RECONCILIATION_REQUIRED" },
    });
    expect(context.repository.commitCount(context.householdId)).toBe(1);
    const recovered = await successful(context.service, "hfj_commit_delivery_index", input, owner);
    expect(recovered.data).toMatchObject({ status: "completed", provider_origin: bundle.origin });
    expect(context.repository.commitCount(context.householdId)).toBe(1);
  });
});

interface DeliveryBundle {
  readonly seed: number;
  readonly origin: ProviderOrigin;
  readonly providerLabel: string;
  readonly evidence: readonly DeliveryOrderLineEvidence[];
  readonly items: readonly DeliveryDishItem[];
  readonly profile: DeliveryProfile["providers"][number];
}

function deliveryBundle(
  seed: number,
  origin: string,
  providerLabel: string,
  actorId: ActorId,
  lineCount: number,
): DeliveryBundle {
  const providerOrigin = ProviderOriginSchema.parse(origin);
  const evidence = Array.from({ length: lineCount }, (_, index): DeliveryOrderLineEvidence => {
    const suffix = (seed + index).toString().padStart(16, "0");
    return {
      id: EvidenceIdSchema.parse(`evd_${suffix}`),
      kind: "delivery_order_line",
      observed_at: "2026-07-15T12:00:00.000Z",
      evidence_date: "2026-07-14",
      date_precision: "day",
      source_type: "delivery_provider",
      source_label: providerLabel,
      stable_locator: `provider-line-${seed}-${index}`,
      summary: `Delivery dish ${index + 1}`,
      actor_id: actorId,
      limitations: [],
      schema_version: 1,
      delivery_order_line: {
        provider_label: providerLabel,
        provider_origin: providerOrigin,
        provider_order_locator: ProviderOrderLocatorSchema.parse(`private-order-${seed}`),
        order_group_locator: DeliveryOrderGroupLocatorSchema.parse(`private-group-${seed}`),
        order_date: "2026-07-14",
        completion_status: "completed",
        fulfillment_mode: "delivery",
        group_complete: true,
        declared_line_count: lineCount,
        line_key: DeliveryOrderLineKeySchema.parse(`line-${index + 1}`),
        restaurant: {
          restaurant_name: "Wanpo",
          public_location_label: seed === 430 ? "Cupertino" : "Palo Alto",
          public_merchant_address: { locality: seed === 430 ? "Cupertino" : "Palo Alto", region: "CA" },
          merchant_locator: ProviderMerchantLocatorSchema.parse(`private-merchant-${seed}`),
        },
        dish_name: index === 0 ? "Wintermelon boba" : "Popcorn chicken",
        quantity: 1,
        modifiers_complete: true,
        modifiers: [{ group_name: "Option", option_name: `Choice ${index + 1}` }],
        historical_menu_item_locator: ProviderMenuItemLocatorSchema.parse(`private-menu-${seed}-${index}`),
        classification: { kind: "food", authored_by: "agent" },
      },
    };
  });
  const items = evidence.map((entry, index): DeliveryDishItem => {
    const line = entry.delivery_order_line;
    return {
      id: ItemIdSchema.parse(`itm_${(seed + index).toString().padStart(16, "0")}`),
      kind: "delivery_dish",
      dish_name: line.dish_name,
      provider_label: line.provider_label,
      provider_origin: line.provider_origin,
      restaurant_name: line.restaurant.restaurant_name,
      public_location_label: line.restaurant.public_location_label,
      public_merchant_address: line.restaurant.public_merchant_address,
      image_url: `https://images.example.test/delivery-${seed}-${index}.jpg`,
      image_page_url: `${providerOrigin}menu/${seed}/${index}`,
      merchant_locator: line.restaurant.merchant_locator,
      known_menu_item_locators: line.historical_menu_item_locator === null ? [] : [line.historical_menu_item_locator],
      known_modifier_occurrences: [{
        evidence_id: entry.id,
        modifiers_complete: true,
        modifiers: line.modifiers,
      }],
      classification: line.classification,
      evidence_ids: [entry.id],
      created_at: entry.observed_at,
      updated_at: entry.observed_at,
      schema_version: 1,
      body_markdown: "",
    };
  });
  return {
    seed,
    origin: providerOrigin,
    providerLabel,
    evidence,
    items,
    profile: {
      provider_label: providerLabel,
      provider_origin: providerOrigin,
      history_start: "2026-01-01",
      history_end: "2026-07-15",
      completed_history_cursor: {
        completed_order_date: "2026-07-14",
        provider_order_locator: ProviderOrderLocatorSchema.parse(`private-order-${seed}`),
      },
    },
  };
}

function profileDocument(bundles: readonly DeliveryBundle[]) {
  return {
    profile: {
      providers: bundles.map(({ profile }) => profile),
      interpretation_preferences: [],
      schema_version: 1 as const,
    },
    markdown: "",
  };
}

function aggregateReport(bundles: readonly DeliveryBundle[]): DeliveryIndexReport {
  return {
    report_type: "delivery_index",
    markdown: "# Delivery",
    assertions: bundles.flatMap((bundle) => bundle.items.map((item, index) => ({
      row_id: `row-${bundle.seed}-${index}`,
      item_ids: [item.id],
      evidence_ids: [...item.evidence_ids],
      distinct_order_count: 1,
      last_date: "2026-07-14",
    }))),
    schema_version: 1,
  };
}

function commitInput(
  householdId: HouseholdId,
  expectedHead: GitObjectId,
  bundle: DeliveryBundle,
  state: {
    readonly expectedProfile?: ReturnType<typeof profileDocument> | null;
    readonly expectedReport?: DeliveryIndexReport | null;
    readonly expectedProfileRevision?: GitObjectId | null;
    readonly expectedReportRevision?: GitObjectId | null;
    readonly nextProfile: ReturnType<typeof profileDocument>;
    readonly nextReport: DeliveryIndexReport;
    readonly mode?: "connected_audit_checkpoint" | "local_promotion";
  },
) {
  return {
    mode: state.mode ?? "connected_audit_checkpoint",
    household_id: householdId,
    expected_head: expectedHead,
    provider_idempotency_key: `provider-${bundle.seed}-delivery`,
    household_visibility_confirmed: true,
    provider_origin: bundle.origin,
    expected_delivery_profile_revision: state.expectedProfileRevision ?? null,
    expected_delivery_report_revision: state.expectedReportRevision ?? null,
    expected_profile: state.expectedProfile ?? null,
    next_profile: state.nextProfile,
    expected_report: state.expectedReport ?? null,
    next_report: state.nextReport,
    evidence: bundle.evidence,
    items: bundle.items,
    expected_item_revisions: {},
  };
}

async function serviceContext() {
  const store = new MemoryOperationalStore();
  const repository = new MemoryHouseholdRepository();
  const service = new HouseholdFoodJournalService(
    store,
    repository,
    new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
    new DeterministicRandomSource(),
    new HmacTokenHasher("delivery-history-test-pepper"),
    new NoopTelemetry(),
    new URL("https://journal.example.test"),
  );
  const created = await service.call("hfj_create_household", {
    name: "Delivery Kitchen",
    idempotency_key: "delivery-household-0401",
  }, owner);
  if (!created.ok) throw new Error(created.error.code);
  const householdId = HouseholdIdSchema.parse(
    typeof created.data === "object" && created.data !== null && !Array.isArray(created.data)
      ? created.data.household_id
      : undefined,
  );
  const head = GitObjectIdSchema.parse(created.repository_head);
  return { store, repository, service, householdId, head };
}

async function addMember(
  store: MemoryOperationalStore,
  householdId: HouseholdId,
  principal: Principal,
  role: "editor" | "viewer",
  head: GitObjectId,
): Promise<void> {
  await store.upsertMembership({
    householdId,
    userId: principal.userId,
    actorId: principal.actorId,
    role,
    projectionHead: head,
    removedAt: null,
  });
}

async function successful(
  service: HouseholdFoodJournalService,
  name: Parameters<HouseholdFoodJournalService["call"]>[0],
  input: Record<string, unknown>,
  principal: Principal,
): Promise<{ readonly data: Record<string, JsonValue>; readonly head: GitObjectId }> {
  if (input.household_id === "") {
    throw new Error("Household ID must be assigned before calling the service");
  }
  const result = await service.call(name, input, principal);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  if (result.data === null || Array.isArray(result.data) || typeof result.data !== "object") {
    throw new Error("Expected object data");
  }
  return {
    data: result.data,
    head: GitObjectIdSchema.parse(result.repository_head),
  };
}
