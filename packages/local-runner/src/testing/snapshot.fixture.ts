import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { GitObjectIdSchema, HouseholdIdSchema, type HouseholdSnapshotResponse } from "@hfj/contracts";

const householdId = HouseholdIdSchema.parse("hsh_0000000000000801");

export function snapshotResponse(headCharacter = "a", entries: Record<string, string> = {
  FORMAT_VERSION: "1\n",
  "profiles/snacks.md": "# Shops\n",
  "snacks/items/cashews.md": "# Salted cashews\n",
  "ingredients/items/parsley.md": "# Flat-leaf parsley\n",
  "condiments/items/mayonnaise.md": "# Standard mayonnaise\n",
  "groceries/items/dish-soap.md": "# Dish soap\n",
  "groceries/evidence/2026/order-one.json": "{\"store\":\"Market\"}\n",
}): HouseholdSnapshotResponse {
  const files = Object.entries(entries).sort(([left], [right]) => left.localeCompare(right));
  const contentHash = createHash("sha256");
  for (const [path, content] of files) {
    contentHash.update(path).update("\0").update(String(Buffer.byteLength(content))).update("\0").update(content).update("\0");
  }
  return {
    manifest: {
      household_id: householdId,
      head: GitObjectIdSchema.parse(headCharacter.repeat(40)),
      content_sha256: contentHash.digest("hex"),
      created_at: "2026-07-20T16:00:00.000Z",
      files: files.map(([path, content]) => ({
        path,
        sha256: createHash("sha256").update(content).digest("hex"),
        bytes: Buffer.byteLength(content),
        mode: 0o600,
      })),
    },
    archive_base64: Buffer.from(zipSync(Object.fromEntries(files.map(([path, content]) => [path, strToU8(content)])))).toString("base64"),
  };
}
