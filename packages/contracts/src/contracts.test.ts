import { describe, expect, it } from "vitest";
import {
  CollectionSnapshotSchema,
  DeliveryDishCollectionItemSchema,
  DeliveryCartBaselineSchema,
  DeliveryCartFinalObservationSchema,
  type DeliveryCartPlan,
  DeliveryCartPlanSchema,
  DeliveryCartPricingSchema,
  DeliveryCartReplacementSchema,
  DeliveryCartSessionSchema,
  DeliveryDishItemSchema,
  ImportedDeliveryDishItemSchema,
  DeliveryIndexReportSchema,
  DELIVERY_COMMIT_MAX_EVIDENCE,
  DELIVERY_COMMIT_MAX_ITEMS,
  DeliveryOrderGroupLocatorSchema,
  DeliveryOrderGroupSchema,
  DeliveryOrderLineKeySchema,
  DeliveryOrderLineEvidenceSchema,
  DeliveryProfileSchema,
  DeliveryToolInputSchemas,
  DeliveryToolOutputSchemas,
  EvidenceSchema,
  HostActionReceiptSchema,
  HostReadyToActSchema,
  HouseholdSnapshotManifestSchema,
  JournalItemSchema,
  MEAL_PLAN_MAX_EVENTS_PER_WEEK,
  MEAL_PLAN_MAX_PROPOSALS_PER_SLOT,
  MEAL_PLAN_MAX_PROPOSALS_PER_WEEK,
  MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK,
  MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK,
  MealPlanEventSchema,
  MealPlanningConstraintsSchema,
  MealPlanningToolInputSchemas,
  MealProposalSchema,
  OnboardingRecordSchema,
  OnboardingSectionStateSchema,
  ONBOARDING_COMMIT_MAX_EVIDENCE,
  ONBOARDING_COMMIT_MAX_ITEMS,
  RunnerClaimRequestSchema,
  RunnerCompletionSchema,
  ProviderOriginSchema,
  ProviderMenuItemLocatorSchema,
  ProviderMerchantLocatorSchema,
  ProviderOrderLocatorSchema,
  ReportSchema,
  RESTOCKING_SNAPSHOT_MAX_FILES,
  SafeHttpsUrlSchema,
  ToolInputSchemas,
  parseMealPlanningToolInput,
  parseToolInput,
} from "./index.js";

describe("contract boundaries", () => {
  it("rejects private fields from a public collection snapshot", () => {
    const result = CollectionSnapshotSchema.safeParse({
      id: "snp_0123456789abcdef",
      collection_id: "col_0123456789abcdef",
      title: "Favorites",
      sharer_display_name: null,
      items: [],
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      household_id: "hsh_0123456789abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("publishes and imports only public delivery-dish fields", () => {
    const publicDish = {
      collection_item_id: "collection-delivery-0001",
      kind: "delivery_dish",
      title: "Wintermelon boba",
      restaurant_name: "Wanpo",
      public_location_label: "Stanford",
      public_merchant_address: {
        locality: "Palo Alto",
        region: "CA",
        country: "United States",
      },
      public_description: "A refreshing tea.",
      public_note: null,
      image_url: "https://images.example.test/wintermelon.jpg",
      image_page_url: "https://example.test/wintermelon",
      source_display_attribution: "Shared by a Fullwell household",
      source_item_revision: "a".repeat(40),
    };
    expect(DeliveryDishCollectionItemSchema.safeParse(publicDish).success).toBe(true);
    expect(DeliveryDishCollectionItemSchema.safeParse({
      ...publicDish,
      classification: "alcohol",
    }).success).toBe(true);
    for (const privateField of [
      "source_item_id",
      "provider_origin",
      "provider_order_locator",
      "order_group_locator",
      "merchant_locator",
      "historical_menu_item_locator",
      "order_date",
      "distinct_order_count",
      "known_modifier_occurrences",
      "actor_id",
      "source_account_id",
      "delivery_destination",
    ]) {
      expect(DeliveryDishCollectionItemSchema.safeParse({
        ...publicDish,
        [privateField]: "private-value",
      }).success).toBe(false);
    }

    const imported = {
      id: "itm_0123456789abcdee",
      kind: "delivery_dish",
      delivery_authority: "public_import",
      dish_name: publicDish.title,
      restaurant_name: publicDish.restaurant_name,
      public_location_label: publicDish.public_location_label,
      public_merchant_address: publicDish.public_merchant_address,
      image_url: publicDish.image_url,
      image_page_url: publicDish.image_page_url,
      source_display_attribution: publicDish.source_display_attribution,
      classification: { kind: "food", authored_by: "agent" },
      import_provenance: {
        source_collection_id: "col_0123456789abcdef",
        source_snapshot_id: "snp_0123456789abcdef",
        source_collection_item_id: publicDish.collection_item_id,
        published_revision: publicDish.source_item_revision,
        source_display_attribution: publicDish.source_display_attribution,
        imported_at: "2026-07-25T12:00:00.000Z",
      },
      evidence_ids: ["evd_0123456789abcdee"],
      created_at: "2026-07-25T12:00:00.000Z",
      updated_at: "2026-07-25T12:00:00.000Z",
      schema_version: 1,
      body_markdown: publicDish.public_description,
    };
    expect(ImportedDeliveryDishItemSchema.safeParse(imported).success).toBe(true);
    expect(DeliveryDishItemSchema.safeParse(imported).success).toBe(true);
    for (const privateField of [
      "provider_label",
      "provider_origin",
      "merchant_locator",
      "known_menu_item_locators",
      "known_modifier_occurrences",
      "delivery_order_line",
      "delivery_profile",
      "delivery_report",
      "recurrence",
      "liked",
      "reorder_authority",
    ]) {
      expect(ImportedDeliveryDishItemSchema.safeParse({
        ...imported,
        [privateField]: privateField.endsWith("s") ? [] : "private-value",
      }).success).toBe(false);
    }
  });

  it("requires purchase-private fields at ingestion", () => {
    const result = EvidenceSchema.safeParse({
      id: "evd_0123456789abcdef",
      kind: "purchase",
      observed_at: "2026-07-15T12:00:00.000Z",
      evidence_date: "2026-07-15",
      date_precision: "day",
      source_type: "store",
      source_label: "Market",
      stable_locator: "order/1/item/2",
      summary: "Cookies",
      actor_id: "act_0123456789abcdef",
      limitations: [],
      schema_version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("canonicalizes only exact credential-free HTTPS provider origins", () => {
    expect(ProviderOriginSchema.parse("https://Delivery.Example")).toBe("https://delivery.example/");
    expect(ProviderOriginSchema.parse("https://delivery.example/")).toBe("https://delivery.example/");
    for (const origin of [
      "http://delivery.example/",
      "https://user:password@delivery.example/",
      "https://@delivery.example/",
      "https://:@delivery.example/",
      "https://delivery.example:443/",
      "https://%64elivery.example/",
      "https://0177.0.0.1/",
      " https://delivery.example/",
      "https://delivery.example/ ",
      "https:\\\\delivery.example\\",
      "https://delivery.example\\orders",
      "https://delivery.example/orders",
      "https://delivery.example/?account=1",
      "https://delivery.example/#orders",
      "https://delivery.example/\t",
      "https://delivery.\nexample/",
      "https://delivery.example/\r",
    ]) {
      expect(ProviderOriginSchema.safeParse(origin).success).toBe(false);
    }
    for (const code of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
      const origin = `https://delivery.exa${String.fromCodePoint(code)}mple/`;
      expect(ProviderOriginSchema.safeParse(origin).success).toBe(false);
    }
  });

  it("preserves opaque provider locator identity without trimming", () => {
    const locatorSchemas = [
      ProviderOrderLocatorSchema,
      DeliveryOrderGroupLocatorSchema,
      ProviderMerchantLocatorSchema,
      ProviderMenuItemLocatorSchema,
      DeliveryOrderLineKeySchema,
    ];
    for (const schema of locatorSchemas) {
      expect(schema.parse("merchant Stanford 001")).toBe("merchant Stanford 001");
      for (const locator of [
        " locator",
        "locator ",
        "\u00a0locator",
        "locator\u00a0",
        "\tlocator",
        "locator\t",
        "\nlocator",
        "locator\n",
        "\rlocator",
        "locator\r",
      ]) {
        expect(schema.safeParse(locator).success).toBe(false);
      }
      for (const code of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
        expect(schema.safeParse(`locator${String.fromCodePoint(code)}value`).success).toBe(false);
      }
    }
  });

  it("accepts an immutable complete delivery order group in the shared evidence union", () => {
    const first = deliveryEvidenceFixture(1);
    const second = deliveryEvidenceFixture(2);
    const group = DeliveryOrderGroupSchema.parse({ lines: [first, second] });
    expect(group.lines).toHaveLength(2);
    expect(Object.isFrozen(group)).toBe(true);
    expect(Object.isFrozen(group.lines)).toBe(true);
    expect(Object.isFrozen(group.lines[0])).toBe(true);
    expect(group.lines[0]?.stable_locator).not.toBe(group.lines[1]?.stable_locator);
    expect(Reflect.set(group.lines, "0", group.lines[1])).toBe(false);
    expect(group.lines[0]?.id).toBe(first.id);
    expect(group.lines[0]?.delivery_order_line.restaurant.public_merchant_address).toEqual({
      address_lines: ["180 El Camino Real"],
      locality: "Palo Alto",
      region: "CA",
      postal_code: "94304",
      country: "United States",
    });
    const publicAddressLines =
      group.lines[0]?.delivery_order_line.restaurant.public_merchant_address?.address_lines;
    if (publicAddressLines === undefined) throw new Error("Delivery fixture requires public merchant address lines");
    expect(Object.isFrozen(publicAddressLines)).toBe(true);
    expect(Reflect.set(publicAddressLines, "0", "Different merchant address")).toBe(false);
    expect(publicAddressLines[0]).toBe("180 El Camino Real");
    expect(Object.isFrozen(group.lines[0]?.delivery_order_line.modifiers)).toBe(true);
    expect(EvidenceSchema.safeParse(first).success).toBe(true);
    expect(DeliveryOrderLineEvidenceSchema.safeParse({
      ...first,
      delivery_order_line: { ...first.delivery_order_line, unexpected_private_data: "no" },
    }).success).toBe(false);
    for (const completionStatus of ["cancelled", "refunded", "incomplete", "Completed", " completed "]) {
      expect(DeliveryOrderLineEvidenceSchema.safeParse({
        ...first,
        delivery_order_line: {
          ...first.delivery_order_line,
          completion_status: completionStatus,
        },
      }).success).toBe(false);
    }
    expect(DeliveryOrderLineEvidenceSchema.safeParse({
      ...first,
      source_type: "import",
    }).success).toBe(false);
    expect(DeliveryOrderLineEvidenceSchema.safeParse({
      ...first,
      source_label: "Uber Eats",
    }).success).toBe(false);
    for (const invalidLine of [
      { ...first.delivery_order_line, quantity: 0 },
      { ...first.delivery_order_line, modifiers_complete: false },
      { ...first.delivery_order_line, group_complete: false },
      {
        ...first.delivery_order_line,
        classification: { kind: "food", authored_by: "user" },
      },
      {
        ...first.delivery_order_line,
        restaurant: {
          ...first.delivery_order_line.restaurant,
          public_merchant_address: {
            ...first.delivery_order_line.restaurant.public_merchant_address,
            address_lines: ["x".repeat(201)],
          },
        },
      },
    ]) {
      expect(DeliveryOrderLineEvidenceSchema.safeParse({
        ...first,
        delivery_order_line: invalidLine,
      }).success).toBe(false);
    }
    expect(DeliveryOrderLineEvidenceSchema.safeParse({
      ...first,
      delivery_order_line: {
        ...first.delivery_order_line,
        classification: { kind: "alcohol", authored_by: "agent" },
      },
    }).success).toBe(true);
  });

  it("rejects incomplete, conflicting, or non-unique delivery order groups", () => {
    const first = deliveryEvidenceFixture(1);
    const second = deliveryEvidenceFixture(2);
    expect(DeliveryOrderGroupSchema.safeParse({
      lines: [
        first,
        {
          ...second,
          delivery_order_line: {
            ...second.delivery_order_line,
            line_key: first.delivery_order_line.line_key,
          },
        },
      ],
    }).success).toBe(false);
    expect(DeliveryOrderGroupSchema.safeParse({
      lines: [first, { ...second, id: first.id }],
    }).success).toBe(false);
    for (const conflictingEvidence of [
      { ...second, actor_id: "act_9999999999999999" },
      { ...second, source_type: "browser_history" },
      { ...second, source_label: "Uber Eats" },
    ]) {
      expect(DeliveryOrderGroupSchema.safeParse({
        lines: [first, conflictingEvidence],
      }).success).toBe(false);
    }
    const conflictingLines = [
      { ...second.delivery_order_line, provider_label: "Uber Eats" },
      { ...second.delivery_order_line, provider_origin: "https://other-delivery.example/" },
      { ...second.delivery_order_line, provider_order_locator: "order-200" },
      { ...second.delivery_order_line, order_group_locator: "order-200-delivery" },
      { ...second.delivery_order_line, order_date: "2026-07-21" },
      { ...second.delivery_order_line, fulfillment_mode: "pickup" },
      { ...second.delivery_order_line, declared_line_count: 3 },
      {
        ...second.delivery_order_line,
        restaurant: { ...second.delivery_order_line.restaurant, restaurant_name: "Wanpo Tea" },
      },
      {
        ...second.delivery_order_line,
        restaurant: { ...second.delivery_order_line.restaurant, public_location_label: "Cupertino" },
      },
      {
        ...second.delivery_order_line,
        restaurant: { ...second.delivery_order_line.restaurant, merchant_locator: "merchant-cupertino" },
      },
      {
        ...second.delivery_order_line,
        restaurant: {
          ...second.delivery_order_line.restaurant,
          public_merchant_address: {
            ...second.delivery_order_line.restaurant.public_merchant_address,
            locality: "Cupertino",
          },
        },
      },
    ];
    for (const conflictingLine of conflictingLines) {
      expect(DeliveryOrderGroupSchema.safeParse({
        lines: [first, { ...second, delivery_order_line: conflictingLine }],
      }).success).toBe(false);
    }
    expect(DeliveryOrderGroupSchema.safeParse({
      lines: [first],
    }).success).toBe(false);
  });

  it("accepts a complete source-line plan and every explicit delivery-cart state", () => {
    const plan = DeliveryCartPlanSchema.parse(deliveryCartPlanFixture());
    expect(plan.source_lines.map(({ operation }) => operation)).toEqual(["replace", "retain"]);
    expect(plan.preserved_cart_line_keys).toEqual(["cart-taro"]);
    expect(plan.pricing).toMatchObject({
      currency: "USD",
      requested_food_subtotal_minor: 1_700,
      preserved_food_subtotal_minor: 575,
      displayed_cart_food_subtotal_minor: 2_275,
      automatic_add_maximum_minor: 5_000,
      decision: "automatic",
    });

    const targets = plan.source_lines.flatMap(({ target }) => target === null ? [] : [target]);
    const common = {
      session_id: plan.session_id,
      authority: plan.authority,
      updated_at: "2026-07-22T12:05:00.000Z",
    };
    const sessions = [
      {
        ...common,
        state: "resolving",
        unresolved_step: "restaurant_location",
        plan: null,
      },
      {
        ...common,
        state: "needs_input",
        input_kind: "provider",
        prompt: "DoorDash or Uber Eats?",
        options: ["DoorDash", "Uber Eats"],
        plan: null,
      },
      {
        ...common,
        state: "action_uncertain",
        reason: "provider_result_unverifiable",
        plan,
      },
      {
        ...common,
        state: "blocked",
        reason: "captcha_required",
        plan,
      },
      {
        ...common,
        state: "cancelled",
        reason: "User cancelled",
        plan,
      },
      {
        ...common,
        state: "cart_prepared",
        plan,
        result: {
          status: "completed",
          provider_label: plan.provider_label,
          provider_origin: plan.provider_origin,
          restaurant_name: plan.restaurant.restaurant_name,
          public_location_label: plan.restaurant.public_location_label,
          lines: targets,
          currency: plan.pricing.currency,
          requested_food_subtotal_minor: plan.pricing.requested_food_subtotal_minor,
          displayed_cart_food_subtotal_minor: plan.pricing.displayed_cart_food_subtotal_minor,
          final_cart: deliveryCartFinalObservationFixture(plan),
          manual_checkout_statement: "I stopped before checkout; please review the cart and place the order yourself.",
        },
      },
    ];
    for (const session of sessions) {
      expect(DeliveryCartSessionSchema.safeParse(session).success).toBe(true);
    }
  });

  it("requires one exact retain, remove, replace, or quantity decision per source line", () => {
    const base = deliveryCartPlanFixture();
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      source_lines: [base.source_lines[0]],
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      source_lines: [base.source_lines[0], base.source_lines[0]],
    }).success).toBe(false);

    const retained = base.source_lines[1];
    if (retained?.target === null || retained === undefined) throw new Error("Cart fixture requires one retained target");
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      source_lines: [
        base.source_lines[0],
        {
          ...retained,
          target: { ...retained.target, quantity: retained.target.quantity + 1 },
        },
      ],
      pricing: {
        ...base.pricing,
        requested_food_subtotal_minor: 2_650,
        displayed_cart_food_subtotal_minor: 3_225,
      },
    }).success).toBe(false);

    const quantityAndRemove = {
      ...base,
      source_lines: [
        {
          source_line_key: "line-1",
          baseline_cart_line_key: null,
          baseline_quantity: 0,
          operation: "remove",
          authorized_decrement_quantity: 0,
          baseline_remainder_quantity: 0,
          target: null,
        },
        {
          ...retained,
          operation: "quantity",
          target: { ...retained.target, quantity: 2 },
        },
      ],
      pricing: {
        ...base.pricing,
        requested_food_subtotal_minor: 1_900,
        displayed_cart_food_subtotal_minor: 2_475,
      },
    };
    expect(DeliveryCartPlanSchema.safeParse(quantityAndRemove).success).toBe(true);
    expect(DeliveryCartPlanSchema.safeParse({
      ...quantityAndRemove,
      source_lines: [
        quantityAndRemove.source_lines[0],
        {
          ...quantityAndRemove.source_lines[1],
          target: retained.target,
        },
      ],
      pricing: {
        ...base.pricing,
        requested_food_subtotal_minor: 950,
        displayed_cart_food_subtotal_minor: 1_525,
      },
    }).success).toBe(false);

    const replacement = base.source_lines[0];
    if (replacement?.target === null || replacement === undefined) throw new Error("Cart fixture requires one replacement target");
    const source = base.source_order.lines[0]?.delivery_order_line;
    if (source === undefined) throw new Error("Cart fixture requires source evidence");
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      source_lines: [{
        ...replacement,
        target: {
          ...replacement.target,
          current_menu_item_locator: source.historical_menu_item_locator,
          dish_name: source.dish_name,
          modifiers: source.modifiers,
        },
      }, retained],
      pricing: base.pricing,
    }).success).toBe(false);
  });

  it("authorizes replace and remove against only one exact existing source cart line", () => {
    const replacePlan = deliveryCartPlanWithSourceInCart("replace");
    expect(DeliveryCartPlanSchema.safeParse(replacePlan).success).toBe(true);
    expect(replacePlan.source_lines[0]).toMatchObject({
      source_line_key: "line-1",
      baseline_cart_line_key: "cart-coconut",
      baseline_quantity: 1,
      operation: "replace",
    });
    expect(replacePlan.preserved_cart_line_keys).toEqual(["cart-taro"]);

    const removePlan = deliveryCartPlanWithSourceInCart("remove");
    expect(DeliveryCartPlanSchema.safeParse(removePlan).success).toBe(true);
    expect(removePlan.source_lines[0]).toEqual({
      source_line_key: "line-1",
      baseline_cart_line_key: "cart-coconut",
      baseline_quantity: 1,
      operation: "remove",
      authorized_decrement_quantity: 1,
      baseline_remainder_quantity: 0,
      target: null,
    });
    expect(removePlan.preserved_cart_line_keys).toEqual(["cart-taro"]);
    const completedRemoval = deliveryCartPreparedSessionFixture(
      DeliveryCartPlanSchema.parse(removePlan),
    );
    expect(DeliveryCartSessionSchema.safeParse(completedRemoval).success).toBe(true);
    expect(completedRemoval.result.final_cart.lines.map(({ line_key }) => line_key).sort()).toEqual([
      "cart-popcorn",
      "cart-taro",
    ]);

    const retainedMapping = replacePlan.source_lines[1];
    if (retainedMapping?.target === null || retainedMapping === undefined) {
      throw new Error("Mapped cart fixture requires retained popcorn");
    }
    const popcornBaseline = {
      line_key: retainedMapping.target.line_key,
      current_menu_item_locator: retainedMapping.target.current_menu_item_locator,
      dish_name: retainedMapping.target.dish_name,
      modifiers: retainedMapping.target.modifiers,
      quantity: retainedMapping.target.quantity,
      unit_price_minor: retainedMapping.target.unit_price_minor,
    };
    const withRetainedSource = {
      ...replacePlan,
      source_lines: [
        replacePlan.source_lines[0],
        {
          ...retainedMapping,
          baseline_cart_line_key: popcornBaseline.line_key,
          baseline_quantity: popcornBaseline.quantity,
        },
      ],
      cart_baseline: {
        ...replacePlan.cart_baseline,
        lines: [...replacePlan.cart_baseline.lines, popcornBaseline],
      },
    };
    expect(DeliveryCartPlanSchema.safeParse(withRetainedSource).success).toBe(true);
    expect(DeliveryCartPlanSchema.safeParse({
      ...withRetainedSource,
      source_lines: [
        withRetainedSource.source_lines[0],
        {
          ...withRetainedSource.source_lines[1],
          target: {
            ...retainedMapping.target,
            current_menu_item_locator: "different-popcorn",
          },
        },
      ],
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...withRetainedSource,
      source_lines: [
        withRetainedSource.source_lines[0],
        {
          ...withRetainedSource.source_lines[1],
          operation: "quantity",
          target: { ...retainedMapping.target, quantity: 2 },
        },
      ],
      pricing: {
        ...replacePlan.pricing,
        requested_food_subtotal_minor: 2_650,
        displayed_cart_food_subtotal_minor: 3_225,
      },
    }).success).toBe(true);

    expect(DeliveryCartPlanSchema.safeParse({
      ...replacePlan,
      source_lines: [
        { ...replacePlan.source_lines[0], baseline_cart_line_key: null, baseline_quantity: 0 },
        replacePlan.source_lines[1],
      ],
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...replacePlan,
      source_lines: [
        { ...replacePlan.source_lines[0], baseline_cart_line_key: "cart-taro" },
        replacePlan.source_lines[1],
      ],
    }).success).toBe(false);

    const coconutLine = replacePlan.cart_baseline.lines[0];
    if (coconutLine === undefined) throw new Error("Mapped cart fixture requires coconut");
    const ambiguous = {
      ...replacePlan,
      cart_baseline: {
        ...replacePlan.cart_baseline,
        lines: [
          coconutLine,
          { ...coconutLine, line_key: "cart-coconut-duplicate" },
          ...replacePlan.cart_baseline.lines.slice(1),
        ],
      },
      preserved_cart_line_keys: ["cart-coconut-duplicate", "cart-taro"],
    };
    expect(DeliveryCartPlanSchema.safeParse(ambiguous).success).toBe(false);
  });

  it("requires a complete exact final-cart reread before cart_prepared", () => {
    const plan = DeliveryCartPlanSchema.parse(deliveryCartPlanWithSourceInCart("replace"));
    const completed = deliveryCartPreparedSessionFixture(plan);
    expect(DeliveryCartSessionSchema.safeParse(completed).success).toBe(true);
    expect(completed.result.final_cart.lines.map(({ line_key }) => line_key).sort()).toEqual([
      "cart-popcorn",
      "cart-taro",
      "cart-wintermelon",
    ]);

    const target = completed.result.final_cart.lines.find(({ line_key }) =>
      line_key === "cart-wintermelon");
    if (target === undefined) throw new Error("Prepared cart fixture requires wintermelon");
    const failures = [
      {
        ...completed.result.final_cart,
        lines: completed.result.final_cart.lines.filter(({ line_key }) =>
          line_key !== "cart-wintermelon"),
      },
      {
        ...completed.result.final_cart,
        lines: completed.result.final_cart.lines.map((line) =>
          line.line_key === target.line_key
            ? { ...line, modifiers: [{ group_name: "Sweetness", option_name: "100%" }] }
            : line),
      },
      {
        ...completed.result.final_cart,
        lines: completed.result.final_cart.lines.map((line) =>
          line.line_key === target.line_key ? { ...line, quantity: line.quantity + 1 } : line),
      },
      {
        ...completed.result.final_cart,
        lines: completed.result.final_cart.lines.filter(({ line_key }) =>
          line_key !== "cart-taro"),
      },
      {
        ...completed.result.final_cart,
        lines: [
          ...completed.result.final_cart.lines,
          plan.cart_baseline.lines[0],
        ],
      },
      {
        ...completed.result.final_cart,
        restaurant: { ...completed.result.final_cart.restaurant, public_location_label: "Cupertino" },
      },
      {
        ...completed.result.final_cart,
        fulfillment_mode: "pickup",
      },
      {
        ...completed.result.final_cart,
        displayed_cart_food_subtotal_minor:
          completed.result.final_cart.displayed_cart_food_subtotal_minor + 1,
      },
      {
        ...completed.result.final_cart,
        provider_label: "Uber Eats",
      },
    ];
    for (const finalCart of failures) {
      expect(DeliveryCartSessionSchema.safeParse({
        ...completed,
        result: { ...completed.result, final_cart: finalCart },
      }).success).toBe(false);
    }
  });

  it("preserves excess mapped quantity and keeps requested and displayed subtotals distinct", () => {
    const base = deliveryCartPlanWithSourceInCart("replace");
    const coconut = base.cart_baseline.lines[0];
    const mapping = base.source_lines[0];
    if (coconut === undefined || mapping === undefined || mapping.operation !== "replace") {
      throw new Error("Excess-quantity fixture requires a mapped coconut replacement");
    }
    const excessPlan = {
      ...base,
      source_lines: [{
        ...mapping,
        baseline_quantity: 3,
        authorized_decrement_quantity: 1,
        baseline_remainder_quantity: 2,
      }, base.source_lines[1]],
      cart_baseline: {
        ...base.cart_baseline,
        visible_summary: "Wanpo Stanford: Coconut Milk Tea x3; Taro Pudding x1",
        lines: [{ ...coconut, quantity: 3 }, ...base.cart_baseline.lines.slice(1)],
      },
      pricing: {
        ...base.pricing,
        requested_food_subtotal_minor: 1_700,
        preserved_food_subtotal_minor: 2_125,
        displayed_cart_food_subtotal_minor: 3_825,
      },
    };
    const parsed = DeliveryCartPlanSchema.parse(excessPlan);
    expect(parsed.pricing).toMatchObject({
      requested_food_subtotal_minor: 1_700,
      preserved_food_subtotal_minor: 2_125,
      displayed_cart_food_subtotal_minor: 3_825,
    });
    const completed = deliveryCartPreparedSessionFixture(parsed);
    expect(DeliveryCartSessionSchema.safeParse(completed).success).toBe(true);
    expect(completed.result.final_cart.lines).toContainEqual({
      ...coconut,
      quantity: 2,
    });

    for (const unauthorized of [
      {
        ...mapping,
        baseline_quantity: 3,
        authorized_decrement_quantity: 3,
        baseline_remainder_quantity: 0,
      },
      {
        ...mapping,
        baseline_quantity: 3,
        authorized_decrement_quantity: 1,
        baseline_remainder_quantity: 0,
      },
    ]) {
      expect(DeliveryCartPlanSchema.safeParse({
        ...excessPlan,
        source_lines: [unauthorized, excessPlan.source_lines[1]],
      }).success).toBe(false);
    }

    expect(DeliveryCartPlanSchema.safeParse({
      ...excessPlan,
      pricing: {
        ...excessPlan.pricing,
        automatic_add_maximum_minor: 3_825,
      },
    }).success).toBe(true);
    const confirmationRequired = {
      ...excessPlan,
      pricing: {
        ...excessPlan.pricing,
        automatic_add_maximum_minor: 1_700,
        decision: "confirmation_required",
      },
    };
    const pendingConfirmation = DeliveryCartPlanSchema.parse(confirmationRequired);
    const confirmed = {
      ...pendingConfirmation,
      pricing: { ...pendingConfirmation.pricing, decision: "user_confirmed" },
      confirmation: deliveryCartConfirmationFixture(pendingConfirmation),
    };
    expect(DeliveryCartPlanSchema.safeParse(confirmed).success).toBe(true);
    expect(DeliveryCartPlanSchema.safeParse({
      ...confirmed,
      confirmation: {
        ...confirmed.confirmation,
        displayed_cart_food_subtotal_minor: 3_824,
      },
    }).success).toBe(false);
  });

  it("replaces a different-location cart before mapping same-dish source quantities", () => {
    const pending = deliveryCartPlanFixture({
      replacement: true,
      pricingDecision: "confirmation_required",
    });
    const source = pending.source_order.lines[0]?.delivery_order_line;
    if (source === undefined) throw new Error("Replacement fixture requires a historical source line");
    const oldLocationCoconut = {
      line_key: "cart-cupertino-coconut",
      current_menu_item_locator: "current-cupertino-coconut",
      dish_name: source.dish_name,
      modifiers: source.modifiers,
      quantity: 3,
      unit_price_minor: 775,
    };
    const replacementPlan = {
      ...pending,
      cart_baseline: {
        ...pending.cart_baseline,
        visible_summary: "Wanpo Cupertino: Coconut Milk Tea x3",
        lines: [oldLocationCoconut],
      },
    };
    const confirmed = {
      ...replacementPlan,
      pricing: { ...replacementPlan.pricing, decision: "user_confirmed" as const },
      confirmation: deliveryCartConfirmationFixture(replacementPlan),
    };
    const parsed = DeliveryCartPlanSchema.parse(confirmed);
    expect(parsed.pricing).toMatchObject({
      requested_food_subtotal_minor: 1_700,
      preserved_food_subtotal_minor: 0,
      displayed_cart_food_subtotal_minor: 1_700,
    });
    const completed = deliveryCartPreparedSessionFixture(parsed);
    expect(DeliveryCartSessionSchema.safeParse(completed).success).toBe(true);
    expect(completed.result.final_cart.lines.map(({ line_key }) => line_key).sort()).toEqual([
      "cart-popcorn",
      "cart-wintermelon",
    ]);

    const sourceMapping = replacementPlan.source_lines[0];
    if (sourceMapping === undefined || sourceMapping.operation !== "replace") {
      throw new Error("Replacement fixture requires a replacement mapping");
    }
    expect(DeliveryCartPlanSchema.safeParse({
      ...confirmed,
      source_lines: [{
        ...sourceMapping,
        baseline_cart_line_key: oldLocationCoconut.line_key,
        baseline_quantity: 3,
        authorized_decrement_quantity: 1,
        baseline_remainder_quantity: 2,
      }, confirmed.source_lines[1]],
      pricing: {
        ...confirmed.pricing,
        preserved_food_subtotal_minor: 1_550,
        displayed_cart_food_subtotal_minor: 3_250,
      },
      confirmation: null,
    }).success).toBe(false);
  });

  it("rejects inconsistent cart observations, mapping authority, pricing, and replacement metadata", () => {
    const parsed = DeliveryCartPlanSchema.parse(deliveryCartPlanFixture());
    const baselineLine = parsed.cart_baseline.lines[0];
    if (baselineLine === undefined) throw new Error("Cart fixture requires a baseline line");
    expect(DeliveryCartBaselineSchema.safeParse({
      ...parsed.cart_baseline,
      lines: [baselineLine, baselineLine],
    }).success).toBe(false);

    const finalCart = deliveryCartFinalObservationFixture(parsed);
    const finalLine = finalCart.lines[0];
    if (finalLine === undefined) throw new Error("Cart fixture requires a final line");
    expect(DeliveryCartFinalObservationSchema.safeParse({
      ...finalCart,
      lines: [finalLine, finalLine],
    }).success).toBe(false);

    const pricing = parsed.pricing;
    expect(DeliveryCartPricingSchema.safeParse({
      ...pricing,
      comparison: "same_or_lower",
    }).success).toBe(false);
    expect(DeliveryCartPricingSchema.safeParse({
      ...pricing,
      previous_requested_food_subtotal_minor: pricing.requested_food_subtotal_minor - 1,
      comparison: "increased",
    }).success).toBe(true);
    expect(DeliveryCartPricingSchema.safeParse({
      ...pricing,
      previous_requested_food_subtotal_minor: pricing.requested_food_subtotal_minor + 1,
      comparison: "same_or_lower",
    }).success).toBe(true);
    expect(DeliveryCartPricingSchema.safeParse({
      ...pricing,
      previous_requested_food_subtotal_minor: pricing.requested_food_subtotal_minor - 1,
      comparison: "same_or_lower",
    }).success).toBe(false);
    expect(DeliveryCartReplacementSchema.safeParse({
      required: true,
      reason: null,
    }).success).toBe(false);
    expect(DeliveryCartReplacementSchema.safeParse({
      required: false,
      reason: "different_restaurant_or_location",
    }).success).toBe(false);

    const mapped = deliveryCartPlanWithSourceInCart("replace");
    const mappedSource = mapped.source_lines[0];
    if (mappedSource === undefined) throw new Error("Cart fixture requires a mapped source");
    expect(DeliveryCartPlanSchema.safeParse({
      ...mapped,
      source_lines: [
        { ...mappedSource, baseline_cart_line_key: "missing-cart-line" },
        mapped.source_lines[1],
      ],
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...mapped,
      source_lines: [
        mappedSource,
        {
          ...mapped.source_lines[1],
          baseline_cart_line_key: mappedSource.baseline_cart_line_key,
          baseline_quantity: 1,
        },
      ],
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...mapped,
      source_lines: [
        { ...mappedSource, source_line_key: "unmapped-source-line" },
        mapped.source_lines[1],
      ],
    }).success).toBe(false);

    const address = mapped.restaurant.public_merchant_address;
    if (address === null) throw new Error("Cart fixture requires a public merchant address");
    expect(DeliveryCartPlanSchema.safeParse({
      ...mapped,
      cart_baseline: {
        ...mapped.cart_baseline,
        restaurant: {
          ...mapped.restaurant,
          public_merchant_address: { ...address, locality: "Cupertino" },
        },
      },
    }).success).toBe(false);
  });

  it("binds pricing and destructive replacement confirmation to the exact active plan", () => {
    const base = deliveryCartPlanFixture();
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      pricing: {
        ...base.pricing,
        requested_food_subtotal_minor: 1_701,
        displayed_cart_food_subtotal_minor: 2_276,
      },
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      preserved_cart_line_keys: [],
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      source_lines: [
        { ...base.source_lines[0], baseline_quantity: 1 },
        base.source_lines[1],
      ],
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      cart_baseline: {
        ...base.cart_baseline,
        restaurant: {
          ...base.restaurant,
          public_location_label: "Cupertino",
        },
      },
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      pricing: {
        ...base.pricing,
        automatic_add_maximum_minor: 1_700,
      },
    }).success).toBe(false);
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      pricing: {
        ...base.pricing,
        previous_requested_food_subtotal_minor: 1_600,
        comparison: "increased",
      },
    }).success).toBe(false);

    const replacementPlan = deliveryCartPlanFixture({
      replacement: true,
      pricingDecision: "confirmation_required",
    });
    expect(DeliveryCartPlanSchema.safeParse(replacementPlan).success).toBe(true);
    const confirmed = {
      ...replacementPlan,
      pricing: { ...replacementPlan.pricing, decision: "user_confirmed" },
      confirmation: deliveryCartConfirmationFixture(replacementPlan),
    };
    expect(DeliveryCartPlanSchema.safeParse(confirmed).success).toBe(true);
    if (confirmed.confirmation === null) throw new Error("Confirmed cart fixture requires confirmation");
    for (const staleConfirmation of [
      { ...confirmed.confirmation, session_id: "ses_0000000000000999" },
      { ...confirmed.confirmation, requested_food_subtotal_minor: 1_701 },
      { ...confirmed.confirmation, visible_cart_fingerprint: `sha256:${"f".repeat(64)}` },
      { ...confirmed.confirmation, lines: confirmed.confirmation.lines.slice(1) },
    ]) {
      expect(DeliveryCartPlanSchema.safeParse({
        ...confirmed,
        confirmation: staleConfirmation,
      }).success).toBe(false);
    }
  });

  it("rejects pickup, stale authority, mismatched completion, and purchasing-shaped fields", () => {
    const base = deliveryCartPlanFixture();
    const pickupLines = base.source_order.lines.map((evidence) => ({
      ...evidence,
      delivery_order_line: {
        ...evidence.delivery_order_line,
        fulfillment_mode: "pickup",
      },
    }));
    expect(DeliveryCartPlanSchema.safeParse({
      ...base,
      source_order: { lines: pickupLines },
    }).success).toBe(false);

    const parsed = DeliveryCartPlanSchema.parse(base);
    const targets = parsed.source_lines.flatMap(({ target }) => target === null ? [] : [target]);
    const completed = {
      session_id: parsed.session_id,
      authority: parsed.authority,
      updated_at: "2026-07-22T12:05:00.000Z",
      state: "cart_prepared",
      plan: parsed,
      result: {
        status: "completed",
        provider_label: parsed.provider_label,
        provider_origin: parsed.provider_origin,
        restaurant_name: parsed.restaurant.restaurant_name,
        public_location_label: parsed.restaurant.public_location_label,
        lines: targets,
        currency: parsed.pricing.currency,
        requested_food_subtotal_minor: parsed.pricing.requested_food_subtotal_minor,
        displayed_cart_food_subtotal_minor: parsed.pricing.displayed_cart_food_subtotal_minor,
        final_cart: deliveryCartFinalObservationFixture(parsed),
        manual_checkout_statement: "I stopped before checkout; please review the cart and place the order yourself.",
      },
    };
    expect(DeliveryCartSessionSchema.safeParse({
      ...completed,
      session_id: "ses_0000000000000999",
    }).success).toBe(false);
    expect(DeliveryCartSessionSchema.safeParse({
      ...completed,
      result: { ...completed.result, requested_food_subtotal_minor: 1_701 },
    }).success).toBe(false);
    const unresolvedConfirmation = DeliveryCartPlanSchema.parse(deliveryCartPlanFixture({
      replacement: true,
      pricingDecision: "confirmation_required",
    }));
    expect(DeliveryCartSessionSchema.safeParse({
      ...completed,
      plan: unresolvedConfirmation,
    }).success).toBe(false);
    expect(DeliveryCartSessionSchema.safeParse({
      session_id: unresolvedConfirmation.session_id,
      authority: unresolvedConfirmation.authority,
      updated_at: completed.updated_at,
      state: "action_uncertain",
      reason: "provider_result_unverifiable",
      plan: unresolvedConfirmation,
    }).success).toBe(false);

    for (const field of [
      "checkout",
      "payment",
      "order_placement",
      "tip",
      "delivery_address",
      "schedule",
      "membership",
      "subscription",
    ]) {
      expect(DeliveryCartPlanSchema.safeParse({ ...base, [field]: "prohibited" }).success).toBe(false);
      expect(DeliveryCartSessionSchema.safeParse({ ...completed, [field]: "prohibited" }).success).toBe(false);
      expect(DeliveryCartSessionSchema.safeParse({
        ...completed,
        result: { ...completed.result, [field]: "prohibited" },
      }).success).toBe(false);
    }
  });

  it("accepts evidence-backed delivery dishes, profiles, and index reports", () => {
    const dish = deliveryDishFixture();
    const parsedDish = DeliveryDishItemSchema.parse(dish);
    expect(Object.isFrozen(parsedDish)).toBe(true);
    expect(parsedDish.public_merchant_address).toEqual({
      address_lines: ["180 El Camino Real"],
      locality: "Palo Alto",
      region: "CA",
      postal_code: "94304",
      country: "United States",
    });
    expect(Object.isFrozen(parsedDish.evidence_ids)).toBe(true);
    expect(Object.isFrozen(parsedDish.public_merchant_address?.address_lines)).toBe(true);
    if ("delivery_authority" in parsedDish) throw new Error("History fixture parsed as a public import");
    expect(Object.isFrozen(parsedDish.known_menu_item_locators)).toBe(true);
    expect(Reflect.set(parsedDish.known_menu_item_locators, "0", "replacement-locator")).toBe(false);
    expect(parsedDish.known_menu_item_locators[0]).toBe("menu-item-1");
    expect(Object.isFrozen(parsedDish.known_modifier_occurrences)).toBe(true);
    expect(Object.isFrozen(parsedDish.known_modifier_occurrences[0]?.modifiers)).toBe(true);
    expect(JournalItemSchema.safeParse(dish).success).toBe(true);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      public_location_label: undefined,
    }).success).toBe(false);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      merchant_locator: undefined,
    }).success).toBe(false);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      public_merchant_address: null,
    }).success).toBe(true);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      public_merchant_address: {
        ...dish.public_merchant_address,
        postal_code: "x".repeat(33),
      },
    }).success).toBe(false);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      public_merchant_address: {
        ...dish.public_merchant_address,
        delivery_destination: "Private home address",
      },
    }).success).toBe(false);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      classification: { kind: "alcohol", authored_by: "agent" },
    }).success).toBe(true);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      classification: { kind: "alcohol", authored_by: "user" },
    }).success).toBe(false);
    expect(DeliveryDishItemSchema.safeParse({
      ...dish,
      known_modifier_occurrences: [{
        evidence_id: "evd_9999999999999999",
        modifiers_complete: true,
        modifiers: [],
      }],
    }).success).toBe(false);
    const report = {
      report_type: "delivery_index",
      markdown: "# Delivery",
      assertions: [{
        row_id: "wanpo-stanford-wintermelon",
        item_ids: [dish.id],
        evidence_ids: dish.evidence_ids,
      }],
      schema_version: 1,
    };
    const parsedReport = DeliveryIndexReportSchema.parse(report);
    expect(Object.isFrozen(parsedReport)).toBe(true);
    expect(Object.isFrozen(parsedReport.assertions)).toBe(true);
    expect(Object.isFrozen(parsedReport.assertions[0])).toBe(true);
    expect(Object.isFrozen(parsedReport.assertions[0]?.item_ids)).toBe(true);
    expect(Object.isFrozen(parsedReport.assertions[0]?.evidence_ids)).toBe(true);
    expect(Reflect.set(parsedReport.assertions[0]?.item_ids ?? [], "0", "itm_9999999999999999")).toBe(false);
    expect(parsedReport.assertions[0]?.item_ids[0]).toBe(dish.id);
    expect(ReportSchema.safeParse(report).success).toBe(true);
    const profile = DeliveryProfileSchema.parse({
      providers: [{
        provider_label: "DoorDash",
        provider_origin: "https://delivery.example",
        history_start: "2025-07-01",
        history_end: "2026-07-01",
        completed_history_cursor: {
          completed_order_date: "2026-06-30",
          provider_order_locator: "order-100",
        },
      }],
      interpretation_preferences: [{
        scope: "restaurant_location",
        instruction: "Treat Wanpo Stanford as the Palo Alto merchant location.",
        confirmation: "user_confirmed",
      }],
      schema_version: 1,
    });
    expect(profile.providers[0]?.completed_history_cursor).toEqual({
      completed_order_date: "2026-06-30",
      provider_order_locator: "order-100",
    });
    expect(profile.interpretation_preferences).toEqual([{
      scope: "restaurant_location",
      instruction: "Treat Wanpo Stanford as the Palo Alto merchant location.",
      confirmation: "user_confirmed",
    }]);
    expect(Object.isFrozen(profile.providers)).toBe(true);
    expect(Reflect.set(profile.providers, "0", profile.providers[0])).toBe(false);
    expect(Object.isFrozen(profile.interpretation_preferences)).toBe(true);
    expect(Reflect.set(profile.interpretation_preferences, "0", {
      scope: "dish",
      instruction: "Mutated preference",
      confirmation: "user_confirmed",
    })).toBe(false);
    const profileWithoutPreferences = DeliveryProfileSchema.parse({
      providers: [],
      schema_version: 1,
    });
    expect(profileWithoutPreferences.interpretation_preferences).toEqual([]);
    expect(Object.isFrozen(profileWithoutPreferences.interpretation_preferences)).toBe(true);
    expect(Reflect.set(profileWithoutPreferences.interpretation_preferences, "0", {
      scope: "dish",
      instruction: "Injected default preference",
      confirmation: "user_confirmed",
    })).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [
        {
          provider_label: "DoorDash",
          provider_origin: "https://delivery.example",
          history_start: "2025-07-01",
          history_end: "2026-07-01",
        },
        {
          provider_label: "DoorDash duplicate",
          provider_origin: "https://delivery.example/",
          history_start: "2025-07-01",
          history_end: "2026-07-01",
        },
      ],
      schema_version: 1,
    }).success).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [{
        provider_label: "DoorDash",
        provider_origin: "https://delivery.example",
        history_start: "2026-07-02",
        history_end: "2026-07-01",
      }],
      schema_version: 1,
    }).success).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [{
        provider_label: "DoorDash",
        provider_origin: "https://delivery.example",
        history_start: "2025-07-01",
        history_end: "2026-07-01",
        completed_history_cursor: {
          provider_order_locator: "order-without-date",
        },
      }],
      schema_version: 1,
    }).success).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [{
        provider_label: "DoorDash",
        provider_origin: "https://delivery.example",
        history_start: "2025-07-01",
        history_end: "2026-07-01",
        completed_history_cursor: {
          completed_order_date: "2026-06-30",
          provider_order_locator: "x".repeat(513),
        },
      }],
      schema_version: 1,
    }).success).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [{
        provider_label: "DoorDash",
        provider_origin: "https://delivery.example",
        history_start: "2025-07-01",
        history_end: "2026-07-01",
        completed_history_cursor: {
          completed_order_date: "2026-07-02",
          provider_order_locator: "order-after-window",
        },
      }],
      schema_version: 1,
    }).success).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [],
      interpretation_preferences: [{
        scope: "dish",
        instruction: "x".repeat(501),
        confirmation: "user_confirmed",
      }],
      schema_version: 1,
    }).success).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [],
      interpretation_preferences: [{
        scope: "dish",
        instruction: "Prefer the wintermelon alias.",
        confirmation: "agent_inferred",
      }],
      schema_version: 1,
    }).success).toBe(false);
    expect(DeliveryProfileSchema.safeParse({
      providers: [],
      interpretation_preferences: Array.from({ length: 51 }, () => ({
        scope: "order",
        instruction: "Use the most recent complete order.",
        confirmation: "user_confirmed",
      })),
      schema_version: 1,
    }).success).toBe(false);
  });

  it("keeps every legacy journal write closed to delivery and mixed payloads", () => {
    const mutation = {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "delivery-bypass-1",
    };
    const deliveryEvidence = deliveryEvidenceFixture(1);
    const deliveryDish = deliveryDishFixture();
    const deliveryReport = {
      report_type: "delivery_index",
      markdown: "# Delivery",
      assertions: [],
      schema_version: 1,
    };
    expect(() => parseToolInput("hfj_append_evidence", {
      ...mutation,
      evidence: [deliveryEvidence],
    })).toThrow();
    expect(() => parseToolInput("hfj_append_evidence", {
      ...mutation,
      evidence: [onboardingEvidence(1), deliveryEvidence],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_change_set", {
      ...mutation,
      items: [deliveryDish],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_change_set", {
      ...mutation,
      items: [onboardingItem(1), deliveryDish],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_change_set", {
      ...mutation,
      reports: [deliveryReport],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_change_set", {
      ...mutation,
      reports: [nonDeliveryReportFixture(), deliveryReport],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...mutation,
      evidence: [deliveryEvidence],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...mutation,
      evidence: [onboardingEvidence(1), deliveryEvidence],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...mutation,
      items: [deliveryDish],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...mutation,
      items: [onboardingItem(1), deliveryDish],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...mutation,
      reports: [deliveryReport],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...mutation,
      reports: [nonDeliveryReportFixture(), deliveryReport],
    })).toThrow();
    expect(parseToolInput("hfj_get_profile", {
      household_id: mutation.household_id,
      profile: "delivery",
    })).toMatchObject({ profile: "delivery" });
    expect(() => parseToolInput("hfj_update_profile", {
      ...mutation,
      profile: "delivery",
      markdown: "# Delivery",
    })).toThrow();
  });

  it("keeps collection and meal-source contracts closed until their owning milestones", () => {
    const dish = deliveryDishFixture();
    expect(CollectionSnapshotSchema.safeParse({
      id: "snp_0123456789abcdef",
      collection_id: "col_0123456789abcdef",
      title: "Delivery",
      sharer_display_name: null,
      items: [{
        collection_item_id: "collection-delivery-1",
        source_item_id: dish.id,
        kind: "delivery_dish",
        title: dish.dish_name,
        public_description: null,
        source_item_revision: "a".repeat(40),
      }],
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
    }).success).toBe(false);
    const proposal = mealProposalFixture();
    expect(DeliveryDishItemSchema.safeParse(dish).success).toBe(true);
    expect(parseMealPlanningToolInput("hfj_add_meal_proposal", {
      household_id: "hsh_0123456789abcdef",
      idempotency_key: "delivery-meal-1",
      week_start: proposal.week_start,
      meal_date: proposal.meal_date,
      slot: proposal.slot,
      source: {
        kind: "journal_delivery_dish",
        item_id: dish.id,
        item_revision: "a".repeat(40),
        evidence_ids: dish.evidence_ids,
      },
      constraint_revision: "a".repeat(40),
      constraint_review_event_id: "mle_0123456789abcdef",
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients need review.",
    })).toMatchObject({
      source: {
        kind: "journal_delivery_dish",
        item_id: dish.id,
        item_revision: "a".repeat(40),
        evidence_ids: dish.evidence_ids,
      },
    });
    expect(() => parseMealPlanningToolInput("hfj_add_meal_proposal", {
      household_id: "hsh_0123456789abcdef",
      idempotency_key: "delivery-meal-unsafe-1",
      week_start: proposal.week_start,
      meal_date: proposal.meal_date,
      slot: proposal.slot,
      source: {
        kind: "journal_delivery_dish",
        item_id: dish.id,
        item_revision: "a".repeat(40),
        evidence_ids: dish.evidence_ids,
      },
      constraint_revision: "a".repeat(40),
      constraint_review_event_id: "mle_0123456789abcdef",
      compatibility: "appears_compatible",
      compatibility_caveat: "The menu title looks safe.",
    })).toThrow();
    expect(MealProposalSchema.safeParse({
      ...proposal,
      proposed_by: { kind: "local", label: "Maya" },
      constraint_revision: 1,
      source: {
        kind: "journal_delivery_dish",
        item_id: dish.id,
        item_revision: `sha256:${"b".repeat(64)}`,
        evidence_ids: dish.evidence_ids,
      },
      compatibility: "incomplete_evidence",
    }).success).toBe(true);
    expect(MealProposalSchema.safeParse({
      ...proposal,
      source: {
        kind: "journal_delivery_dish",
        item_id: dish.id,
        item_revision: "a".repeat(40),
        evidence_ids: [dish.evidence_ids[0], dish.evidence_ids[0]],
      },
      compatibility: "incomplete_evidence",
    }).success).toBe(false);
  });

  it("requires explicit duplicate resolution for imports", () => {
    expect(() => parseToolInput("hfj_import_collection_items", {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "import-key-1",
      token: "x".repeat(43),
      selections: [{ collection_item_id: "collection-item-1" }],
    })).toThrow();
  });

  it("publishes the complete stable tool catalog", () => {
    expect(Object.keys(ToolInputSchemas)).toHaveLength(35);
    expect(ToolInputSchemas.hfj_get_context).toBeDefined();
    expect(ToolInputSchemas.hfj_update_user_display_name).toBeDefined();
    expect(ToolInputSchemas.hfj_update_household_name).toBeDefined();
    expect(ToolInputSchemas.hfj_update_onboarding).toBeDefined();
    expect(ToolInputSchemas.hfj_commit_onboarding).toBeDefined();
    expect(ToolInputSchemas.hfj_export_household).toBeDefined();
    expect(Object.keys(DeliveryToolInputSchemas)).toEqual([
      "hfj_search_delivery_history",
      "hfj_get_delivery_order",
      "hfj_get_delivery_index",
      "hfj_commit_delivery_index",
    ]);
    expect(Object.keys(MealPlanningToolInputSchemas)).toEqual([
      "hfj_get_meal_plan",
      "hfj_update_meal_planning_constraints",
      "hfj_review_meal_constraints",
      "hfj_add_meal_proposal",
      "hfj_withdraw_meal_proposal",
    ]);
    for (const name of Object.keys(MealPlanningToolInputSchemas)) {
      expect(ToolInputSchemas[name as keyof typeof MealPlanningToolInputSchemas]).toBeDefined();
    }
  });

  it("bounds connected delivery-history reads and requires one confirmed provider mutation", () => {
    const providerOrigin = ProviderOriginSchema.parse("https://delivery.example");
    const profile = DeliveryProfileSchema.parse({
      providers: [{
        provider_label: "DoorDash",
        provider_origin: providerOrigin,
        history_start: "2026-01-01",
        history_end: "2026-07-22",
        completed_history_cursor: null,
      }],
      interpretation_preferences: [],
      schema_version: 1,
    });
    const report = DeliveryIndexReportSchema.parse({
      report_type: "delivery_index",
      markdown: "# Delivery",
      assertions: [],
      schema_version: 1,
    });
    const input = {
      mode: "connected_audit_checkpoint",
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      provider_idempotency_key: "delivery-provider-1",
      household_visibility_confirmed: true,
      provider_origin: providerOrigin,
      expected_delivery_profile_revision: null,
      expected_delivery_report_revision: null,
      expected_profile: null,
      next_profile: { profile, markdown: "" },
      expected_report: null,
      next_report: report,
      evidence: [deliveryEvidenceFixture(1), deliveryEvidenceFixture(2)],
      items: [deliveryDishFixture()],
      expected_item_revisions: {},
    };
    const maximumExpectedItemRevisions = Object.fromEntries(Array.from(
      { length: DELIVERY_COMMIT_MAX_ITEMS },
      (_, index) => [`itm_${index.toString(36).padStart(16, "0")}`, "b".repeat(40)],
    ));
    expect(DeliveryToolInputSchemas.hfj_commit_delivery_index.parse(input)).toMatchObject({
      mode: "connected_audit_checkpoint",
      household_visibility_confirmed: true,
      provider_origin: providerOrigin,
    });
    expect(Object.keys(DeliveryToolInputSchemas.hfj_commit_delivery_index.parse({
      ...input,
      expected_item_revisions: maximumExpectedItemRevisions,
    }).expected_item_revisions)).toHaveLength(DELIVERY_COMMIT_MAX_ITEMS);
    expect(() => DeliveryToolInputSchemas.hfj_commit_delivery_index.parse({
      ...input,
      expected_item_revisions: {
        ...maximumExpectedItemRevisions,
        itm_zzzzzzzzzzzzzzzz: "b".repeat(40),
      },
    })).toThrow();
    expect(() => DeliveryToolInputSchemas.hfj_commit_delivery_index.parse({
      ...input,
      household_visibility_confirmed: false,
    })).toThrow();
    expect(() => DeliveryToolInputSchemas.hfj_commit_delivery_index.parse({
      ...input,
      evidence: [{
        ...deliveryEvidenceFixture(1),
        delivery_order_line: {
          ...deliveryEvidenceFixture(1).delivery_order_line,
          provider_origin: "https://other.example/",
        },
      }],
    })).toThrow();
    expect(() => DeliveryToolInputSchemas.hfj_search_delivery_history.parse({
      household_id: "hsh_0123456789abcdef",
      limit: 51,
    })).toThrow();
    expect(() => DeliveryToolInputSchemas.hfj_get_delivery_order.parse({
      household_id: "hsh_0123456789abcdef",
      group_handle: "private-order-reference",
    })).toThrow();
    const maximumEvidence = Array.from(
      { length: DELIVERY_COMMIT_MAX_EVIDENCE },
      (_, index) => deliveryEvidenceFixture(index + 1),
    );
    expect(DeliveryToolInputSchemas.hfj_commit_delivery_index.safeParse({
      ...input,
      evidence: maximumEvidence,
      items: [],
    }).success).toBe(true);
    expect(DeliveryToolInputSchemas.hfj_commit_delivery_index.safeParse({
      ...input,
      evidence: [...maximumEvidence, deliveryEvidenceFixture(DELIVERY_COMMIT_MAX_EVIDENCE + 1)],
      items: [],
    }).success).toBe(false);
    const maximumItems = Array.from(
      { length: DELIVERY_COMMIT_MAX_ITEMS },
      (_, index) => deliveryDishFixture(index + 1),
    );
    expect(DeliveryToolInputSchemas.hfj_commit_delivery_index.safeParse({
      ...input,
      evidence: [],
      items: maximumItems,
    }).success).toBe(true);
    expect(DeliveryToolInputSchemas.hfj_commit_delivery_index.safeParse({
      ...input,
      evidence: [],
      items: [...maximumItems, deliveryDishFixture(DELIVERY_COMMIT_MAX_ITEMS + 1)],
    }).success).toBe(false);
    expect(() => DeliveryToolInputSchemas.hfj_commit_delivery_index.parse({
      ...input,
      items: [{ ...deliveryDishFixture(), provider_origin: "https://other.example/" }],
    })).toThrow();
    expect(() => DeliveryToolInputSchemas.hfj_commit_delivery_index.parse({
      ...input,
      items: [deliveryDishFixture(), deliveryDishFixture()],
    })).toThrow();
    expect(() => DeliveryToolInputSchemas.hfj_commit_delivery_index.parse({
      ...input,
      next_profile: {
        profile: { ...profile, providers: [] },
        markdown: "",
      },
    })).toThrow();
    expect(() => DeliveryToolOutputSchemas.hfj_search_delivery_history.parse({
      candidates: [{
        group_handle: `dgrp_${"a".repeat(48)}`,
        dish_name: "Tea",
        provider_label: "DoorDash",
        restaurant_name: "Wanpo",
        public_location_label: "Palo Alto",
        public_merchant_address: null,
        revision: "a".repeat(40),
        provider_order_locator: "private-order",
      }],
      next_cursor: null,
    })).toThrow();
  });

  it("normalizes names while rejecting control characters", () => {
    expect(parseToolInput("hfj_update_user_display_name", {
      display_name: "  Taylor  ",
      idempotency_key: "member-name-1",
    })).toMatchObject({ display_name: "Taylor" });
    expect(() => parseToolInput("hfj_update_household_name", {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "household-name-1",
      name: "Kitchen\nTable",
    })).toThrow();
  });

  it("freezes bounded cloud meal-plan capacity", () => {
    expect({
      eventsPerWeek: MEAL_PLAN_MAX_EVENTS_PER_WEEK,
      proposalsPerSlot: MEAL_PLAN_MAX_PROPOSALS_PER_SLOT,
      proposalsPerWeek: MEAL_PLAN_MAX_PROPOSALS_PER_WEEK,
      reviewEventsPerWeek: MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK,
      withdrawalEventsPerWeek: MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK,
    }).toEqual({
      eventsPerWeek: 1_000,
      proposalsPerSlot: 48,
      proposalsPerWeek: 500,
      reviewEventsPerWeek: 500,
      withdrawalEventsPerWeek: 500,
    });
  });

  it("keeps unanswered meal constraints distinct from an explicit none", () => {
    expect(MealPlanningConstraintsSchema.safeParse({ status: "unresolved" }).success).toBe(true);
    expect(MealPlanningConstraintsSchema.safeParse({
      status: "confirmed_none",
      time_zone: "America/Los_Angeles",
      reviewed_at: "2026-07-23T12:00:00.000Z",
    }).success).toBe(true);
    expect(MealPlanningConstraintsSchema.safeParse({
      status: "confirmed_none",
      time_zone: "+01:00",
      reviewed_at: "2026-07-23T12:00:00.000Z",
    }).success).toBe(false);
    expect(MealPlanningConstraintsSchema.safeParse({
      status: "recorded",
      time_zone: "America/Los_Angeles",
      allergy_labels: [],
      sensitivity_labels: [],
      reviewed_at: "2026-07-23T12:00:00.000Z",
    }).success).toBe(false);
    expect(() => parseMealPlanningToolInput("hfj_update_meal_planning_constraints", {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "constraints-1",
      constraints: { status: "unresolved" },
    })).toThrow();
  });

  it("accepts immutable proposals only inside their Monday-start week", () => {
    const proposal = mealProposalFixture();
    expect(MealProposalSchema.safeParse(proposal).success).toBe(true);
    expect(MealProposalSchema.safeParse({ ...proposal, week_start: "2026-07-21" }).success).toBe(false);
    expect(MealProposalSchema.safeParse({ ...proposal, meal_date: "2026-08-03" }).success).toBe(false);
    expect(MealProposalSchema.safeParse({ ...proposal, slot: { kind: "custom", label: "" } }).success).toBe(false);
    expect(MealProposalSchema.safeParse({ ...proposal, source: { kind: "freeform", title: "Pizza" } }).success).toBe(true);
  });

  it("requires credential-free HTTPS provenance for external recipes", () => {
    const proposal = mealProposalFixture();
    const source = proposal.source;
    expect(source.kind).toBe("external_recipe");
    if (source.kind !== "external_recipe") throw new Error("external recipe fixture required");
    expect(MealProposalSchema.safeParse({
      ...proposal,
      source: { ...source, canonical_url: "http://recipes.example/soup" },
    }).success).toBe(false);
    expect(MealProposalSchema.safeParse({
      ...proposal,
      source: { ...source, canonical_url: "https://user:pass@recipes.example/soup" },
    }).success).toBe(false);
    expect(MealProposalSchema.safeParse({
      ...proposal,
      source: { ...source, raw_html: "<script>bad()</script>" },
    }).success).toBe(false);
    expect(SafeHttpsUrlSchema.safeParse(`https://recipes.example/${"x".repeat(2048)}`).success).toBe(false);
  });

  it("parses bounded meal-plan tool inputs and rejects mismatched dates", () => {
    expect(parseMealPlanningToolInput("hfj_add_meal_proposal", {
      household_id: "hsh_0123456789abcdef",
      idempotency_key: "meal-proposal-1",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" },
      source: { kind: "freeform", title: "Egg salad sandwich" },
      constraint_revision: "a".repeat(40),
      constraint_review_event_id: "mle_0123456789abcdef",
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients and cross-contact details still need review.",
    })).toMatchObject({ slot: { kind: "lunch" }, servings: null, notes: null });
    expect(() => parseMealPlanningToolInput("hfj_get_meal_plan", {
      household_id: "hsh_0123456789abcdef",
      week_start: "2026-07-21",
    })).toThrow();
    expect(() => parseMealPlanningToolInput("hfj_add_meal_proposal", {
      household_id: "hsh_0123456789abcdef",
      idempotency_key: "meal-proposal-2",
      week_start: "2026-07-20",
      meal_date: "2026-07-27",
      slot: { kind: "lunch" },
      source: { kind: "freeform", title: "Pizza" },
      constraint_revision: "a".repeat(40),
      constraint_review_event_id: "mle_0123456789abcdef",
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not yet known.",
    })).toThrow();
    expect(() => parseMealPlanningToolInput("hfj_review_meal_constraints", {
      household_id: "hsh_0123456789abcdef",
      idempotency_key: "meal-review-1",
      week_start: "2026-07-20",
      constraint_revision: 1,
    })).toThrow();
    expect(() => parseMealPlanningToolInput("hfj_add_meal_proposal", {
      household_id: "hsh_0123456789abcdef",
      idempotency_key: "meal-proposal-3",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" },
      source: {
        kind: "journal_recipe",
        item_id: "itm_0123456789abcdef",
        item_revision: `sha256:${"a".repeat(64)}`,
        liked_evidence_ids: ["evd_0123456789abcdef"],
      },
      constraint_revision: "a".repeat(40),
      constraint_review_event_id: "mle_0123456789abcdef",
      compatibility: "appears_compatible",
      compatibility_caveat: "Verify the current ingredients.",
    })).toThrow();
  });

  it("requires strict append-only meal-plan events", () => {
    const event = MealPlanEventSchema.parse({
      id: "mle_0123456789abcdef",
      kind: "constraints_reviewed",
      week_start: "2026-07-20",
      constraint_revision: 1,
      actor: { kind: "local", label: "Alice" },
      occurred_at: "2026-07-20T12:00:00.000Z",
      schema_version: 1,
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.actor)).toBe(true);
    expect(MealPlanEventSchema.safeParse({
      id: "mle_0123456789abcdef",
      kind: "proposal_withdrawn",
      week_start: "2026-07-20",
      proposal_id: "mlp_0123456789abcdef",
      actor: { kind: "local", label: "" },
      reason: null,
      occurred_at: "2026-07-20T12:00:00.000Z",
      schema_version: 1,
    }).success).toBe(false);
  });

  it("returns immutable proposal content from the parse boundary", () => {
    const proposal = MealProposalSchema.parse(mealProposalFixture());
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.slot)).toBe(true);
    expect(Object.isFrozen(proposal.source)).toBe(true);
  });

  it("accepts every grocery item kind as a search boundary", () => {
    for (const kind of ["snack", "ingredient", "condiment", "other_grocery", "recipe"] as const) {
      expect(parseToolInput("hfj_search_items", {
        household_id: "hsh_0123456789abcdef",
        query: "mayo",
        kind,
      })).toMatchObject({ kind });
    }
    expect(() => parseToolInput("hfj_search_items", {
      household_id: "hsh_0123456789abcdef",
      query: "mayo",
      kind: "household_supply",
    })).toThrow();
  });

  it("keeps onboarding transitions typed and completion server-derived", () => {
    expect(parseToolInput("hfj_update_onboarding", {
      household_id: "hsh_0123456789abcdef",
      section: "snacks",
      transition: { action: "skip", reason: "no_sources" },
      expected_revision: 0,
      idempotency_key: "onboarding-1",
    })).toMatchObject({ transition: { action: "skip", reason: "no_sources" } });
    expect(() => parseToolInput("hfj_update_onboarding", {
      household_id: "hsh_0123456789abcdef",
      section: "recipes",
      transition: { action: "complete" },
      expected_revision: 0,
      idempotency_key: "onboarding-2",
    })).toThrow();
    expect(OnboardingSectionStateSchema.safeParse({ status: "complete", revision: 0 }).success).toBe(true);
    expect(OnboardingRecordSchema.safeParse({
      user_id: "usr_0123456789abcdef",
      household_id: "hsh_0123456789abcdef",
      section: "recipes",
      status: "in_progress",
      skip_reason: "not_now",
      revision: 1,
      updated_at: "2026-07-21T20:00:00.000Z",
    }).success).toBe(false);
  });

  it("requires unique, explicit outcomes in the final onboarding commit", () => {
    const base = {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "onboarding-final-1",
    };
    expect(parseToolInput("hfj_commit_onboarding", {
      ...base,
      sections: [
        { section: "snacks", outcome: "skip", reason: "no_sources", expected_revision: 0 },
        { section: "recipes", outcome: "skip", reason: "not_now", expected_revision: 0 },
      ],
    })).toMatchObject({ sections: [{ section: "snacks" }, { section: "recipes" }] });
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...base,
      sections: [
        { section: "snacks", outcome: "skip", reason: "no_sources", expected_revision: 0 },
        { section: "snacks", outcome: "complete", expected_revision: 0 },
      ],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", base)).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...base,
      profiles: [
        { profile: "snacks", markdown: "first" },
        { profile: "snacks", markdown: "second" },
      ],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...base,
      items: [onboardingItem(0), onboardingItem(0)],
    })).toThrow();
  });

  it("accepts 10,000 onboarding evidence and items but rejects 10,001", () => {
    const evidence = Array.from({ length: ONBOARDING_COMMIT_MAX_EVIDENCE }, (_, index) => onboardingEvidence(index));
    const items = Array.from({ length: ONBOARDING_COMMIT_MAX_ITEMS }, (_, index) => onboardingItem(index));
    const base = {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "onboarding-large-final-1",
    };
    const parsed = parseToolInput("hfj_commit_onboarding", { ...base, evidence, items });
    expect(parsed).toMatchObject({ evidence: { length: ONBOARDING_COMMIT_MAX_EVIDENCE }, items: { length: ONBOARDING_COMMIT_MAX_ITEMS } });
    expect(() => parseToolInput("hfj_commit_onboarding", { ...base, evidence: [...evidence, onboardingEvidence(ONBOARDING_COMMIT_MAX_EVIDENCE)] })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", { ...base, items: [...items, onboardingItem(ONBOARDING_COMMIT_MAX_ITEMS)] })).toThrow();
  });

  it("rejects invalid runner leases and implicit terminal success", () => {
    expect(RunnerClaimRequestSchema.safeParse({
      device_id: "dev_0123456789abcdef",
      wait_seconds: 26,
    }).success).toBe(false);
    expect(RunnerCompletionSchema.safeParse({
      device_id: "dev_0123456789abcdef",
      lease_id: "lse_0123456789abcdef",
      terminal: { kind: "completed" },
      host_session_id: null,
    }).success).toBe(false);
  });

  it("keeps local cart receipts explicit and monotonic", () => {
    const receipt = {
      schema_version: 2,
      request_id: "req_0123456789abcdef",
      envelope_id: "msg_0123456789abcdef",
      selected_item_reference: "snacks/items/cashews.md",
      retailer_origin: "https://grocer.example/",
      retailer_locator: "products/cashews",
      baseline_quantity: 2,
      target_quantity: 2,
      currency: "USD",
      incremental_amount_minor: 4_999,
      automatic_add_maximum_minor: 5_000,
      authorization_mode: "automatic_under_maximum",
      host_session_id: null,
      state: "ready_to_act",
      terminal_message: null,
      updated_at: "2026-07-20T12:00:00.000Z",
    };
    expect(HostActionReceiptSchema.safeParse(receipt).success).toBe(false);
    expect(HostActionReceiptSchema.safeParse({ ...receipt, target_quantity: 3 }).success).toBe(true);
    expect(HostActionReceiptSchema.safeParse({ ...receipt, target_quantity: 3, incremental_amount_minor: 5_000 }).success).toBe(false);
    expect(HostActionReceiptSchema.safeParse({ ...receipt, target_quantity: 3, currency: "CAD" }).success).toBe(false);
    expect(HostActionReceiptSchema.safeParse({
      ...receipt,
      target_quantity: 3,
      state: "completed",
      terminal_message: "I added one bag for $49.99.",
    }).success).toBe(true);
    expect(HostActionReceiptSchema.safeParse({ ...receipt, target_quantity: 3, state: "completed" }).success).toBe(false);
  });

  it("binds automatic cart authority to a strict USD maximum", () => {
    const ready = {
      kind: "ready_to_act",
      selected_item_reference: "snacks/items/cashews.md",
      retailer_origin: "https://grocer.example/",
      retailer_locator: "products/cashews",
      baseline_quantity: 0,
      target_quantity: 1,
      currency: "USD",
      incremental_amount_minor: 4_999,
      automatic_add_maximum_minor: 5_000,
      authorization_mode: "automatic_under_maximum",
      host_session_id: null,
    };
    expect(HostReadyToActSchema.safeParse(ready).success).toBe(true);
    expect(HostReadyToActSchema.safeParse({ ...ready, incremental_amount_minor: 5_000 }).success).toBe(false);
    expect(HostReadyToActSchema.safeParse({ ...ready, automatic_add_maximum_minor: 0 }).success).toBe(false);
    expect(HostReadyToActSchema.safeParse({ ...ready, currency: "CAD" }).success).toBe(false);
    expect(HostReadyToActSchema.safeParse({
      ...ready,
      currency: "CAD",
      incremental_amount_minor: 5_000,
      authorization_mode: "user_confirmed",
    }).success).toBe(true);
    expect(HostReadyToActSchema.safeParse({ ...ready, automatic_add_maximum_minor: 1_000_001 }).success).toBe(false);
  });

  it("parses legacy receipts without granting them priced authority", () => {
    expect(HostActionReceiptSchema.safeParse({
      request_id: "req_0123456789abcdef",
      envelope_id: "msg_0123456789abcdef",
      selected_item_reference: "snacks/items/cashews.md",
      retailer_origin: "https://grocer.example/",
      retailer_locator: "products/cashews",
      baseline_quantity: 0,
      target_quantity: 1,
      host_session_id: null,
      state: "action_uncertain",
      updated_at: "2026-07-20T12:00:00.000Z",
    }).success).toBe(true);
  });

  it("requires hashed, user-only snapshot manifests", () => {
    const manifest = {
      household_id: "hsh_0123456789abcdef",
      head: "a".repeat(40),
      content_sha256: "b".repeat(64),
      created_at: "2026-07-20T12:00:00.000Z",
    };
    const validFile = { path: "profiles/snacks.md", sha256: "c".repeat(64), bytes: 42, mode: 0o600 };
    expect(HouseholdSnapshotManifestSchema.safeParse({
      ...manifest,
      files: [{ ...validFile, mode: 0o644 }],
    }).success).toBe(false);
    expect(HouseholdSnapshotManifestSchema.safeParse({
      ...manifest,
      files: Array.from({ length: RESTOCKING_SNAPSHOT_MAX_FILES }, () => validFile),
    }).success).toBe(true);
    expect(HouseholdSnapshotManifestSchema.safeParse({
      ...manifest,
      files: Array.from({ length: RESTOCKING_SNAPSHOT_MAX_FILES + 1 }, () => validFile),
    }).success).toBe(false);
  });
});

function onboardingEvidence(index: number) {
  return {
    id: `evd_${index.toString(16).padStart(16, "0")}`,
    kind: "user_confirmation",
    observed_at: "2026-07-22T12:00:00.000Z",
    evidence_date: null,
    date_precision: "unknown",
    source_type: "conversation",
    source_label: "Owner",
    stable_locator: `confirmation-${index}`,
    summary: "Confirmed",
    actor_id: "act_0123456789abcdef",
    limitations: [],
    schema_version: 1,
  };
}

function mealProposalFixture() {
  return {
    id: "mlp_0123456789abcdef",
    week_start: "2026-07-20",
    meal_date: "2026-07-20",
    slot: { kind: "lunch" as const },
    proposed_by: "act_0123456789abcdef",
    source: {
      kind: "external_recipe" as const,
      title: "Summer soup",
      canonical_url: "https://recipes.example/summer-soup",
      site_name: "Recipes Example",
      discovered_at: "2026-07-20T12:00:00.000Z",
    },
    servings: 4,
    notes: null,
    constraint_revision: "a".repeat(40),
    constraint_review_event_id: "mle_0123456789abcdef",
    compatibility: "appears_compatible" as const,
    compatibility_caveat: "Appears compatible based on the listed ingredients; verify current labels.",
    created_at: "2026-07-20T12:00:00.000Z",
    schema_version: 1,
  };
}

function onboardingItem(index: number, kind: "snack" | "ingredient" | "condiment" | "other_grocery" = "snack") {
  return {
    id: `itm_${index.toString(16).padStart(16, "0")}`,
    kind,
    display_name: `Snack ${index}`,
    brand: null,
    product_line: null,
    flavor: null,
    formulation: null,
    format: null,
    category: "snack",
    produce_variety: null,
    known_size_variants: [],
    image_page_url: null,
    image_url: null,
    evidence_ids: [`evd_${index.toString(16).padStart(16, "0")}`],
    created_at: "2026-07-22T12:00:00.000Z",
    updated_at: "2026-07-22T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  };
}

function deliveryEvidenceFixture(index: number) {
  return {
    id: `evd_${index.toString(16).padStart(16, "0")}`,
    kind: "delivery_order_line",
    observed_at: "2026-07-22T12:00:00.000Z",
    evidence_date: "2026-07-20",
    date_precision: "day",
    source_type: "delivery_provider",
    source_label: "DoorDash",
    stable_locator: `orders/order-100/lines/${index}`,
    summary: `Wanpo line ${index}`,
    actor_id: "act_0123456789abcdef",
    limitations: [],
    schema_version: 1,
    delivery_order_line: {
      provider_label: "DoorDash",
      provider_origin: "https://delivery.example",
      provider_order_locator: "order-100",
      order_group_locator: "order-100-delivery",
      order_date: "2026-07-20",
      completion_status: "completed",
      fulfillment_mode: "delivery",
      group_complete: true,
      declared_line_count: 2,
      line_key: `line-${index}`,
      restaurant: {
        restaurant_name: "Wanpo",
        public_location_label: "Stanford Shopping Center, Palo Alto",
        public_merchant_address: {
          address_lines: ["180 El Camino Real"],
          locality: "Palo Alto",
          region: "CA",
          postal_code: "94304",
          country: "United States",
        },
        merchant_locator: "merchant-stanford",
      },
      dish_name: index === 1 ? "Wintermelon Boba" : "Popcorn Chicken",
      quantity: 1,
      modifiers_complete: true,
      modifiers: index === 1
        ? [
            { group_name: "Sweetness", option_name: "50%" },
            { group_name: "Ice", option_name: "Less ice" },
          ]
        : [{ group_name: "Spice", option_name: "Spicy" }],
      historical_menu_item_locator: `menu-item-${index}`,
      classification: { kind: "food", authored_by: "agent" },
    },
  };
}

function deliveryDishFixture(index?: number) {
  const evidenceId = index === undefined
    ? "evd_0000000000000001"
    : `evd_${index.toString(16).padStart(16, "0")}`;
  return {
    id: index === undefined
      ? "itm_0123456789abcdee"
      : `itm_${index.toString(16).padStart(16, "0")}`,
    kind: "delivery_dish",
    dish_name: "Wintermelon Boba",
    provider_label: "DoorDash",
    provider_origin: "https://delivery.example/",
    restaurant_name: "Wanpo",
    public_location_label: "Stanford Shopping Center, Palo Alto",
    public_merchant_address: {
      address_lines: ["180 El Camino Real"],
      locality: "Palo Alto",
      region: "CA",
      postal_code: "94304",
      country: "United States",
    },
    merchant_locator: "merchant-stanford",
    known_menu_item_locators: [`menu-item-${index ?? 1}`],
    known_modifier_occurrences: [{
      evidence_id: evidenceId,
      modifiers_complete: true,
      modifiers: [
        { group_name: "Sweetness", option_name: "50%" },
        { group_name: "Ice", option_name: "Less ice" },
      ],
    }],
    classification: { kind: "food", authored_by: "agent" },
    evidence_ids: [evidenceId],
    created_at: "2026-07-22T12:00:00.000Z",
    updated_at: "2026-07-22T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  };
}

function deliveryCartPlanFixture(options: {
  replacement?: boolean;
  pricingDecision?: "automatic" | "confirmation_required" | "user_confirmed";
} = {}) {
  const first = deliveryEvidenceFixture(1);
  const second = deliveryEvidenceFixture(2);
  const restaurant = first.delivery_order_line.restaurant;
  const sourceOrder = {
    lines: [
      {
        ...first,
        delivery_order_line: {
          ...first.delivery_order_line,
          dish_name: "Coconut Milk Tea",
          historical_menu_item_locator: "historical-coconut",
        },
      },
      second,
    ],
  };
  const replacementTarget = {
    line_key: "cart-wintermelon",
    current_menu_item_locator: "current-wintermelon",
    dish_name: "Wintermelon Boba",
    modifiers: first.delivery_order_line.modifiers,
    quantity: 1,
    unit_price_minor: 750,
    classification: { kind: "food", authored_by: "agent" },
  };
  const retainedTarget = {
    line_key: "cart-popcorn",
    current_menu_item_locator: "menu-item-2",
    dish_name: second.delivery_order_line.dish_name,
    modifiers: second.delivery_order_line.modifiers,
    quantity: second.delivery_order_line.quantity,
    unit_price_minor: 950,
    classification: { kind: "food", authored_by: "agent" },
  };
  const replacement = options.replacement ?? false;
  const baselineRestaurant = replacement
    ? {
        ...restaurant,
        public_location_label: "Cupertino",
        public_merchant_address: {
          locality: "Cupertino",
          region: "CA",
          country: "United States",
        },
        merchant_locator: "merchant-cupertino",
      }
    : restaurant;
  const baselineLines = replacement
    ? [{
        line_key: "cart-cupertino-tea",
        current_menu_item_locator: "current-cupertino-tea",
        dish_name: "Signature Tea",
        modifiers: [{ group_name: "Sweetness", option_name: "50%" }],
        quantity: 1,
        unit_price_minor: 795,
      }]
    : [{
        line_key: "cart-taro",
        current_menu_item_locator: "current-taro",
        dish_name: "Taro Pudding",
        modifiers: [],
        quantity: 1,
        unit_price_minor: 575,
      }];
  return {
    session_id: "ses_0123456789abcdef",
    authority: {
      kind: "cloud",
      repository_head: "a".repeat(40),
    },
    observed_at: "2026-07-22T12:00:00.000Z",
    provider_label: "DoorDash",
    provider_origin: "https://delivery.example/",
    restaurant,
    fulfillment_mode: "delivery",
    source_order: sourceOrder,
    source_lines: [
      {
        source_line_key: "line-1",
        baseline_cart_line_key: null,
        baseline_quantity: 0,
        operation: "replace",
        authorized_decrement_quantity: 0,
        baseline_remainder_quantity: 0,
        target: replacementTarget,
      },
      {
        source_line_key: "line-2",
        baseline_cart_line_key: null,
        baseline_quantity: 0,
        operation: "retain",
        target: retainedTarget,
      },
    ],
    cart_baseline: {
      parsed_entire_cart: true,
      fulfillment_mode: "delivery",
      restaurant: baselineRestaurant,
      visible_summary: replacement ? "Wanpo Cupertino: Signature Tea x1" : "Wanpo Stanford: Taro Pudding x1",
      fingerprint: `sha256:${(replacement ? "b" : "a").repeat(64)}`,
      lines: baselineLines,
    },
    preserved_cart_line_keys: replacement ? [] : ["cart-taro"],
    cart_replacement: {
      required: replacement,
      reason: replacement ? "different_restaurant_or_location" : null,
    },
    pricing: {
      currency: "USD",
      requested_food_subtotal_minor: 1_700,
      preserved_food_subtotal_minor: replacement ? 0 : 575,
      displayed_cart_food_subtotal_minor: replacement ? 1_700 : 2_275,
      automatic_add_maximum_minor: 5_000,
      previous_requested_food_subtotal_minor: null,
      comparison: "not_applicable",
      decision: options.pricingDecision ?? "automatic",
    },
    confirmation: null,
  };
}

function deliveryCartPlanWithSourceInCart(operation: "remove" | "replace") {
  const base = deliveryCartPlanFixture();
  const source = base.source_order.lines[0]?.delivery_order_line;
  const firstMapping = base.source_lines[0];
  if (source === undefined || firstMapping === undefined || firstMapping.target === null) {
    throw new Error("Mapped delivery cart fixture requires one replaceable source line");
  }
  const coconutLine = {
    line_key: "cart-coconut",
    current_menu_item_locator: "current-coconut",
    dish_name: source.dish_name,
    modifiers: source.modifiers,
    quantity: 1,
    unit_price_minor: 775,
  };
  return {
    ...base,
    source_lines: [
      operation === "replace"
        ? {
            ...firstMapping,
            baseline_cart_line_key: coconutLine.line_key,
            baseline_quantity: coconutLine.quantity,
            authorized_decrement_quantity: 1,
            baseline_remainder_quantity: 0,
          }
        : {
            source_line_key: firstMapping.source_line_key,
            baseline_cart_line_key: coconutLine.line_key,
            baseline_quantity: coconutLine.quantity,
            operation: "remove",
            authorized_decrement_quantity: 1,
            baseline_remainder_quantity: 0,
            target: null,
          },
      base.source_lines[1],
    ],
    cart_baseline: {
      ...base.cart_baseline,
      visible_summary: "Wanpo Stanford: Coconut Milk Tea x1; Taro Pudding x1",
      lines: [coconutLine, ...base.cart_baseline.lines],
    },
    preserved_cart_line_keys: ["cart-taro"],
    pricing: operation === "replace"
      ? base.pricing
      : {
          ...base.pricing,
          requested_food_subtotal_minor: 950,
          displayed_cart_food_subtotal_minor: 1_525,
        },
  };
}

function deliveryCartConfirmationFixture(
  plan: ReturnType<typeof deliveryCartPlanFixture> | DeliveryCartPlan,
) {
  return {
    session_id: plan.session_id,
    provider_origin: plan.provider_origin,
    merchant_locator: plan.restaurant.merchant_locator,
    public_location_label: plan.restaurant.public_location_label,
    lines: plan.source_lines.flatMap(({ target }) => target === null ? [] : [target]),
    currency: plan.pricing.currency,
    requested_food_subtotal_minor: plan.pricing.requested_food_subtotal_minor,
    preserved_food_subtotal_minor: plan.pricing.preserved_food_subtotal_minor,
    displayed_cart_food_subtotal_minor: plan.pricing.displayed_cart_food_subtotal_minor,
    automatic_add_maximum_minor: plan.pricing.automatic_add_maximum_minor,
    cart_replacement_required: plan.cart_replacement.required,
    visible_cart_summary: plan.cart_baseline.visible_summary,
    visible_cart_fingerprint: plan.cart_baseline.fingerprint,
    confirmation_fingerprint: `sha256:${"c".repeat(64)}`,
  };
}

function deliveryCartPreparedSessionFixture(plan: DeliveryCartPlan) {
  const finalCart = deliveryCartFinalObservationFixture(plan);
  const targets = plan.source_lines.flatMap(({ target }) => target === null ? [] : [target]);
  return {
    session_id: plan.session_id,
    authority: plan.authority,
    updated_at: "2026-07-22T12:05:00.000Z",
    state: "cart_prepared",
    plan,
    result: {
      status: "completed",
      provider_label: plan.provider_label,
      provider_origin: plan.provider_origin,
      restaurant_name: plan.restaurant.restaurant_name,
      public_location_label: plan.restaurant.public_location_label,
      lines: targets,
      currency: plan.pricing.currency,
      requested_food_subtotal_minor: plan.pricing.requested_food_subtotal_minor,
      displayed_cart_food_subtotal_minor: plan.pricing.displayed_cart_food_subtotal_minor,
      final_cart: finalCart,
      manual_checkout_statement: "I stopped before checkout; please review the cart and place the order yourself.",
    },
  };
}

function deliveryCartFinalObservationFixture(plan: DeliveryCartPlan) {
  const targetLines = plan.source_lines.flatMap(({ target }) => target === null ? [] : [{
    line_key: target.line_key,
    current_menu_item_locator: target.current_menu_item_locator,
    dish_name: target.dish_name,
    modifiers: target.modifiers,
    quantity: target.quantity,
    unit_price_minor: target.unit_price_minor,
  }]);
  const baselineByKey = new Map(plan.cart_baseline.lines.map((line) => [line.line_key, line]));
  const preservedLines = plan.preserved_cart_line_keys.flatMap((lineKey) => {
    const line = baselineByKey.get(lineKey);
    return line === undefined ? [] : [line];
  });
  const remainderLines = plan.cart_replacement.required
    ? []
    : plan.source_lines.flatMap((linePlan) => {
      if ((linePlan.operation !== "remove" && linePlan.operation !== "replace")
      || linePlan.baseline_remainder_quantity === 0
      || linePlan.baseline_cart_line_key === null) {
        return [];
      }
      const line = baselineByKey.get(linePlan.baseline_cart_line_key);
      return line === undefined ? [] : [{ ...line, quantity: linePlan.baseline_remainder_quantity }];
    });
  return {
    parsed_entire_cart: true,
    provider_label: plan.provider_label,
    provider_origin: plan.provider_origin,
    fulfillment_mode: "delivery",
    restaurant: plan.restaurant,
    visible_summary: "Wanpo Stanford prepared cart",
    fingerprint: `sha256:${"d".repeat(64)}`,
    lines: [...targetLines, ...preservedLines, ...remainderLines],
    currency: plan.pricing.currency,
    displayed_cart_food_subtotal_minor: plan.pricing.displayed_cart_food_subtotal_minor,
  };
}

function nonDeliveryReportFixture() {
  return {
    report_type: "recurring_snacks",
    markdown: "# Snacks",
    assertions: [],
    schema_version: 1,
  };
}
