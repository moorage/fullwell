import { describe, expect, it } from "vitest";
import { validateRepositoryPath } from "../../apps/server/src/adapters/memory.js";
import { CollectionSnapshotSchema } from "../../packages/contracts/src/domain.js";

describe("security boundaries", () => {
  it.each(["../secrets", "/absolute/path", "recipes//item.md", "recipes/../../secrets"])(
    "rejects unsafe repository path %s",
    (path) => expect(() => validateRepositoryPath(path)).toThrow(/path is invalid/),
  );

  it("rejects private fields in a public collection snapshot", () => {
    const snapshot = {
      id: "snp_0000000000000001",
      collection_id: "col_0000000000000001",
      title: "Public selection",
      created_at: "2026-07-15T12:00:00.000Z",
      sharer_display_name: null,
      items: [{
        collection_item_id: "collection-item-1", source_item_id: "itm_0000000000000001", kind: "recipe", title: "Soup",
        public_description: null, brand: null, flavor: null, formulation: null, format: null, author_or_publisher: null,
        canonical_recipe_url: null, image_url: null, image_page_url: null, preparation_notes: null,
        source_display_attribution: null, source_item_revision: "a".repeat(40),
      }],
      schema_version: 1 as const,
    };
    expect(CollectionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(() => CollectionSnapshotSchema.parse({
      ...snapshot,
      private_household_notes: "must not cross the boundary",
    })).toThrow();
  });
});
