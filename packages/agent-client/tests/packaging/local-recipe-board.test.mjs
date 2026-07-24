import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createLocalRecipeBoard,
  localRecipeBoardsPath,
} from "../../runtime/local-recipe-board.mjs";
import { LocalHouseholdError } from "../../runtime/local-household.mjs";

const now = new Date("2026-07-23T18:00:00.000Z");

async function withLocalRoot(run) {
  const root = await mkdtemp(path.join(tmpdir(), "fullwell-recipe-board-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function boardInput(idempotencyKey = "recipe-board-week-0001") {
  return {
    idempotency_key: idempotencyKey,
    title: "Ideas for this week",
    context_label: "Week of July 20",
    cards: [
      {
        id: "card-tomato-tart",
        title: "Tomato <tart> & thyme",
        image_url: "https://images.example.test/tart.jpg",
        image_page_url: "https://recipes.example.test/tart/photos",
        recipe_url: "https://recipes.example.test/tart",
        source_label: "Example Recipes",
        why_recommended: "Liked before & quick on a weeknight.",
        journal_statuses: ["Saved", "Liked"],
        proposed_slot: "Monday dinner",
        compatibility: "appears_compatible",
        compatibility_caveat: "Available ingredients appear compatible; check the source before cooking.",
      },
      {
        id: "card-pizza",
        title: "Pizza",
        image_url: null,
        image_page_url: null,
        recipe_url: null,
        source_label: "Household idea",
        why_recommended: "A flexible suggestion.",
        journal_statuses: [],
        proposed_slot: null,
        compatibility: "incomplete_evidence",
        compatibility_caveat: "Ingredients are not yet known.",
      },
    ],
  };
}

test("the recipe board is a private deterministic static artifact with strict escaping and CSP", async () => {
  await withLocalRoot(async (root) => {
    const created = await createLocalRecipeBoard(root, boardInput(), now);
    assert.equal(created.status, "created");
    assert.equal(created.card_count, 2);
    assert.equal(created.remote_image_count, 1);
    assert.match(created.board_id, /^lrb_[0-9a-f]{32}$/);
    assert.match(created.file_url, /^file:\/\//);
    assert.equal((await stat(created.file_path)).mode & 0o777, 0o600);
    assert.equal((await stat(path.dirname(created.file_path))).mode & 0o777, 0o700);

    const html = await readFile(created.file_path, "utf8");
    assert.match(html, /default-src &#39;none&#39;/);
    assert.match(html, /img-src https:/);
    assert.doesNotMatch(html, /<script|<form|onerror=|onclick=/i);
    assert.doesNotMatch(html, /Tomato <tart>/);
    assert.match(html, /Tomato &lt;tart&gt; &amp; thyme/);
    assert.match(html, /referrerpolicy="no-referrer"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /Images use anonymous requests but load directly from source sites/);
    assert.match(html, /may use your existing site state/);

    const replayed = await createLocalRecipeBoard(root, boardInput(), new Date("2026-07-24T18:00:00.000Z"));
    assert.equal(replayed.status, "replayed");
    assert.equal(replayed.file_path, created.file_path);
    assert.equal(replayed.created_at, created.created_at);
    await assert.rejects(
      createLocalRecipeBoard(root, { ...boardInput(), title: "Changed title" }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    await writeFile(created.file_path, "<h1>tampered</h1>\n");
    await assert.rejects(
      createLocalRecipeBoard(root, boardInput(), now),
      (error) => error instanceof LocalHouseholdError && error.code === "CORRUPT_LOCAL_RECIPE_BOARD",
    );
  });
});

test("the recipe board rejects unsafe URLs, missing image provenance, excess cards, and symlinked storage", async () => {
  await withLocalRoot(async (root) => {
    const unsafe = boardInput("recipe-board-unsafe-001");
    unsafe.cards[0] = { ...unsafe.cards[0], recipe_url: "javascript:alert(1)" };
    await assert.rejects(
      createLocalRecipeBoard(root, unsafe, now),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );

    const credentials = boardInput("recipe-board-unsafe-002");
    credentials.cards[0] = { ...credentials.cards[0], image_url: "https://user:pass@images.example.test/tart.jpg" };
    await assert.rejects(
      createLocalRecipeBoard(root, credentials, now),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );

    const noProvenance = boardInput("recipe-board-unsafe-003");
    noProvenance.cards[0] = { ...noProvenance.cards[0], image_page_url: null };
    await assert.rejects(
      createLocalRecipeBoard(root, noProvenance, now),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );

    await assert.rejects(
      createLocalRecipeBoard(root, {
        ...boardInput("recipe-board-too-many-01"),
        cards: Array.from({ length: 49 }, (_, index) => ({
          ...boardInput().cards[1],
          id: `card-${index}`,
          title: `Recipe ${index}`,
        })),
      }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );

    const malformedUnicode = boardInput("recipe-board-unicode-001");
    malformedUnicode.cards[0] = { ...malformedUnicode.cards[0], title: "Broken \ud800 title" };
    await assert.rejects(
      createLocalRecipeBoard(root, malformedUnicode, now),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );

    const outside = await mkdtemp(path.join(tmpdir(), "fullwell-board-outside-"));
    try {
      await symlink(outside, path.join(root, "fullwell"));
      await assert.rejects(
        createLocalRecipeBoard(root, boardInput("recipe-board-symlink-001"), now),
        (error) => error instanceof LocalHouseholdError && error.code === "UNSAFE_LOCAL_PATH",
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test("concurrent exact creates converge and generated-board retention stays bounded", async () => {
  await withLocalRoot(async (root) => {
    const [first, second] = await Promise.all([
      createLocalRecipeBoard(root, boardInput("recipe-board-concurrent-1"), now),
      createLocalRecipeBoard(root, boardInput("recipe-board-concurrent-1"), now),
    ]);
    assert.equal(first.file_path, second.file_path);
    assert.deepEqual([first.status, second.status].sort(), ["created", "replayed"]);

    const corruptDirectory = path.join(localRecipeBoardsPath(root), `lrb_${"f".repeat(32)}`);
    await mkdir(corruptDirectory, { recursive: true });
    await writeFile(path.join(corruptDirectory, "index.html"), "incomplete");
    const damaged = await createLocalRecipeBoard(root, boardInput("recipe-board-damaged-001"), now);
    await writeFile(damaged.file_path, "<h1>damaged</h1>");

    for (let index = 0; index < 22; index += 1) {
      await createLocalRecipeBoard(
        root,
        boardInput(`recipe-board-retention-${String(index).padStart(3, "0")}`),
        new Date(now.getTime() + index * 1_000),
      );
    }
    const entries = await readdir(localRecipeBoardsPath(root), { withFileTypes: true });
    assert.ok(entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("lrb_")).length <= 20);
    await assert.rejects(stat(corruptDirectory), (error) => error?.code === "ENOENT");
    await assert.rejects(stat(path.dirname(damaged.file_path)), (error) => error?.code === "ENOENT");
  });
});
