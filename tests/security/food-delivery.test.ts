import {
  ActorIdSchema,
  CloudMealSourceSchema,
  DeliveryCartPlanSchema,
  DeliveryCartSessionSchema,
  DeliveryDishCollectionItemSchema,
  ImportedDeliveryDishItemSchema,
  DeliveryToolOutputSchemas,
  GitObjectIdSchema,
  HouseholdIdSchema,
  MealProposalSchema,
  ProviderOriginSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../../apps/server/src/adapters/memory.js";
import {
  DeterministicRandomSource,
  FixedClock,
  HmacTokenHasher,
} from "../../apps/server/src/adapters/providers.js";
import type { TelemetryPort } from "../../apps/server/src/core/ports.js";
import type { Principal } from "../../apps/server/src/core/types.js";
import { HouseholdFoodJournalService } from "../../apps/server/src/services/household-food-journal.js";

const principal: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000601"),
  actorId: ActorIdSchema.parse("act_0000000000000601"),
  displayName: "Security Owner",
  scopes: new Set(["journal:read", "journal:write", "household:manage"]),
  client: "test",
};

describe("food-delivery security boundaries", () => {
  it("exposes no purchasing or identity controls in delivery-cart contracts", () => {
    const propertyNames = new Set([
      ...jsonSchemaPropertyNames(z.toJSONSchema(DeliveryCartPlanSchema, { io: "input" })),
      ...jsonSchemaPropertyNames(z.toJSONSchema(DeliveryCartSessionSchema, { io: "input" })),
    ]);
    for (const prohibited of [
      "checkout",
      "place_order",
      "payment",
      "tip",
      "address",
      "schedule",
      "membership",
      "subscription",
      "identity_document",
      "birth_date",
      "verification_response",
    ]) {
      expect(propertyNames.has(prohibited), prohibited).toBe(false);
    }
    expect(propertyNames.has("baseline_cart_line_key")).toBe(true);
    expect(propertyNames.has("final_cart")).toBe(true);
    expect(propertyNames.has("parsed_entire_cart")).toBe(true);
    expect(propertyNames.has("manual_checkout_statement")).toBe(true);
  });

  it("keeps public and imported delivery-dish schemas structurally free of private history", () => {
    const propertyNames = new Set([
      ...jsonSchemaPropertyNames(z.toJSONSchema(DeliveryDishCollectionItemSchema, { io: "input" })),
      ...jsonSchemaPropertyNames(z.toJSONSchema(ImportedDeliveryDishItemSchema, { io: "input" })),
    ]);
    for (const prohibited of [
      "provider_label",
      "provider_origin",
      "provider_order_locator",
      "order_group_locator",
      "merchant_locator",
      "historical_menu_item_locator",
      "known_menu_item_locators",
      "known_modifier_occurrences",
      "order_date",
      "distinct_order_count",
      "actor_id",
      "source_account_id",
      "delivery_destination",
      "delivery_order_line",
      "delivery_profile",
      "delivery_report",
      "recurrence",
      "liked",
      "reorder_authority",
    ]) {
      expect(propertyNames.has(prohibited), prohibited).toBe(false);
    }
    for (const requiredPublic of [
      "dish_name",
      "restaurant_name",
      "public_location_label",
      "public_merchant_address",
      "import_provenance",
    ]) {
      expect(propertyNames.has(requiredPublic), requiredPublic).toBe(true);
    }
  });

  it("keeps delivery meal sources bounded to public authority evidence", () => {
    const deliverySource = {
      kind: "journal_delivery_dish",
      item_id: "itm_0000000000000601",
      item_revision: "a".repeat(40),
      evidence_ids: ["evd_0000000000000601"],
    } as const;
    expect(CloudMealSourceSchema.parse(deliverySource)).toEqual(deliverySource);
    expect(CloudMealSourceSchema.safeParse({
      ...deliverySource,
      provider_order_locator: "private-order-0601",
    }).success).toBe(false);

    const proposal = {
      id: "mlp_0000000000000601",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      proposed_by: principal.actorId,
      source: deliverySource,
      servings: 2,
      notes: null,
      constraint_revision: "b".repeat(40),
      constraint_review_event_id: "mle_0000000000000601",
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients and cross-contact details are not known.",
      created_at: "2026-07-20T16:01:00.000Z",
      schema_version: 1,
    } as const;
    expect(MealProposalSchema.safeParse(proposal).success).toBe(true);
    expect(MealProposalSchema.safeParse({
      ...proposal,
      compatibility: "appears_compatible",
    }).success).toBe(false);
  });

  it("keeps private provider locators out of search summaries and telemetry", async () => {
    const event = vi.fn<TelemetryPort["event"]>();
    const error = vi.fn<TelemetryPort["error"]>();
    const telemetry: TelemetryPort = { event, error };
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const service = new HouseholdFoodJournalService(
      store,
      repository,
      new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      new DeterministicRandomSource(),
      new HmacTokenHasher("food-delivery-security-pepper"),
      telemetry,
      new URL("https://journal.example.test"),
    );
    const created = await service.call("hfj_create_household", {
      name: "Security Kitchen",
      idempotency_key: "delivery-security-household",
    }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(
      typeof created.data === "object" && created.data !== null && !Array.isArray(created.data)
        ? created.data.household_id
        : undefined,
    );
    const head = GitObjectIdSchema.parse(created.repository_head);
    const origin = ProviderOriginSchema.parse("https://delivery.example");
    const evidence = {
      id: "evd_0000000000000601",
      kind: "delivery_order_line",
      observed_at: "2026-07-15T12:00:00.000Z",
      evidence_date: "2026-07-14",
      date_precision: "day",
      source_type: "delivery_provider",
      source_label: "DoorDash",
      stable_locator: "private-stable-0601",
      summary: "Wintermelon boba",
      actor_id: principal.actorId,
      limitations: [],
      schema_version: 1,
      delivery_order_line: {
        provider_label: "DoorDash",
        provider_origin: origin,
        provider_order_locator: "private-order-0601",
        order_group_locator: "private-group-0601",
        order_date: "2026-07-14",
        completion_status: "completed",
        fulfillment_mode: "delivery",
        group_complete: true,
        declared_line_count: 1,
        line_key: "private-line-0601",
        restaurant: {
          restaurant_name: "Wanpo",
          public_location_label: "Palo Alto",
          public_merchant_address: { locality: "Palo Alto", region: "CA" },
          merchant_locator: "private-merchant-0601",
        },
        dish_name: "Wintermelon boba",
        quantity: 1,
        modifiers_complete: true,
        modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
        historical_menu_item_locator: "private-menu-0601",
        classification: { kind: "food", authored_by: "agent" },
      },
    };
    const item = {
      id: "itm_0000000000000601",
      kind: "delivery_dish",
      dish_name: "Wintermelon boba",
      provider_label: "DoorDash",
      provider_origin: origin,
      restaurant_name: "Wanpo",
      public_location_label: "Palo Alto",
      public_merchant_address: { locality: "Palo Alto", region: "CA" },
      merchant_locator: "private-merchant-0601",
      known_menu_item_locators: ["private-menu-0601"],
      known_modifier_occurrences: [{
        evidence_id: evidence.id,
        modifiers_complete: true,
        modifiers: evidence.delivery_order_line.modifiers,
      }],
      classification: evidence.delivery_order_line.classification,
      evidence_ids: [evidence.id],
      created_at: evidence.observed_at,
      updated_at: evidence.observed_at,
      schema_version: 1,
      body_markdown: "",
    };
    const profile = {
      profile: {
        providers: [{
          provider_label: "DoorDash",
          provider_origin: origin,
          history_start: "2026-01-01",
          history_end: "2026-07-15",
          completed_history_cursor: {
            completed_order_date: "2026-07-14",
            provider_order_locator: "private-order-0601",
          },
        }],
        interpretation_preferences: [],
        schema_version: 1,
      },
      markdown: "",
    };
    const report = {
      report_type: "delivery_index",
      markdown: "# Delivery",
      assertions: [{
        row_id: "wanpo-wintermelon",
        item_ids: [item.id],
        evidence_ids: [evidence.id],
        distinct_order_count: 1,
        last_date: "2026-07-14",
      }],
      schema_version: 1,
    };
    const committed = await service.call("hfj_commit_delivery_index", {
      mode: "connected_audit_checkpoint",
      household_id: householdId,
      expected_head: head,
      provider_idempotency_key: "delivery-security-provider",
      household_visibility_confirmed: true,
      provider_origin: origin,
      expected_delivery_profile_revision: null,
      expected_delivery_report_revision: null,
      expected_profile: null,
      next_profile: profile,
      expected_report: null,
      next_report: report,
      evidence: [evidence],
      items: [item],
      expected_item_revisions: {},
    }, principal);
    expect(committed).toMatchObject({ ok: true });

    const search = await service.call("hfj_search_delivery_history", {
      household_id: householdId,
      query: "Palo Alto",
      limit: 10,
    }, principal);
    if (!search.ok) throw new Error(search.error.code);
    DeliveryToolOutputSchemas.hfj_search_delivery_history.parse(search.data);
    const publicResult = JSON.stringify(search.data);
    const telemetryResult = JSON.stringify({ events: event.mock.calls, errors: error.mock.calls });
    for (const privateValue of [
      "private-order-0601",
      "private-group-0601",
      "private-merchant-0601",
      "private-menu-0601",
      "private-stable-0601",
    ]) {
      expect(publicResult).not.toContain(privateValue);
      expect(telemetryResult).not.toContain(privateValue);
    }
    expect(error).not.toHaveBeenCalled();
  });
});

function jsonSchemaPropertyNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(jsonSchemaPropertyNames);
  if (value === null || typeof value !== "object") return [];
  const entries = Object.entries(value);
  const ownProperties = entries.find(([key]) => key === "properties")?.[1];
  const names = ownProperties !== null && typeof ownProperties === "object" && !Array.isArray(ownProperties)
    ? Object.keys(ownProperties)
    : [];
  return [...names, ...entries.flatMap(([, nested]) => jsonSchemaPropertyNames(nested))];
}
