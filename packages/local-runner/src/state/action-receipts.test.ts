import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostActionReceiptSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { ActionReceiptStore } from "./action-receipts.js";

const receipt = HostActionReceiptSchema.parse({
  schema_version: 2,
  request_id: "req_0000000000000901",
  envelope_id: "msg_0000000000000901",
  selected_item_reference: "snacks/items/cashews.md",
  retailer_origin: "https://retailer.example.test/",
  retailer_locator: "/products/cashews",
  baseline_quantity: 0,
  target_quantity: 1,
  currency: "USD",
  incremental_amount_minor: 1_299,
  automatic_add_maximum_minor: 5_000,
  authorization_mode: "automatic_under_maximum",
  host_session_id: "session-one",
  state: "ready_to_act",
  terminal_message: null,
  updated_at: "2026-07-20T16:00:00.000Z",
});

describe("ActionReceiptStore", () => {
  it("writes, replaces, reads, and removes private receipts", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-receipts-"));
    try {
      const store = new ActionReceiptStore(root);
      expect(await store.read(receipt.request_id)).toBeNull();
      await store.write(receipt);
      expect(await store.read(receipt.request_id)).toEqual(receipt);
      await store.write({ ...receipt, state: "acting", updated_at: "2026-07-20T16:01:00.000Z" });
      expect((await store.read(receipt.request_id))?.state).toBe("acting");
      expect((await stat(join(root, `${receipt.request_id}.json`))).mode & 0o777).toBe(0o600);
      await store.remove(receipt.request_id);
      expect(await store.read(receipt.request_id)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
