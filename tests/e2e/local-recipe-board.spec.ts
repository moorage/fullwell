import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const LocalMcpResponseSchema = z.object({
  result: z.object({
    content: z.array(z.object({ text: z.string() })).min(1),
  }),
});
const RecipeBoardResultSchema = z.object({
  file_url: z.string(),
  file_path: z.string(),
  card_count: z.number().int(),
});

function reportOpenOutcome(openConfirmed: boolean, boardPath: string): string {
  if (openConfirmed) return "I opened the private recipe board in your browser.";
  return `${boardPath}\nIf that link does not open here, say 'open the recipe board.'`;
}

test("the private recipe board is responsive, ordered, and accessible without live network", async ({ page }, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "fullwell-board-e2e-"));
  try {
    const { handleLocalHouseholdMcpMessage } = await import("../../packages/agent-client/runtime/local-household-mcp.mjs");
    const skill = await readFile("packages/agent-client/skills/plan-household-meals/SKILL.md", "utf8");
    const offer = "Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required. Images load from their source sites.";
    const openedMessage = "I opened the private recipe board in your browser.";
    const fallbackMessage = "If that link does not open here, say 'open the recipe board.'";
    expect(skill).toContain(offer);
    expect(skill).toContain(openedMessage);
    expect(skill).toContain(fallbackMessage);

    const boardInput = {
      idempotency_key: `recipe-board-e2e-${testInfo.project.name}`,
      title: "Ideas for the week",
      context_label: "Week of July 20",
      cards: [
        {
          id: "tomato-tart",
          title: "Tomato tart",
          image_url: "https://images.example.test/tart.jpg",
          image_page_url: "https://recipes.example.test/tart/photos",
          recipe_url: "https://recipes.example.test/tart",
          source_label: "Example Recipes",
          why_recommended: "A liked summer dinner.",
          journal_statuses: ["Saved", "Liked"],
          proposed_slot: "Monday dinner",
          compatibility: "appears_compatible",
          compatibility_caveat: "Appears compatible based on the listed ingredients.",
        },
        {
          id: "pizza",
          title: "Pizza",
          image_url: null,
          image_page_url: null,
          recipe_url: null,
          source_label: "Household idea",
          why_recommended: "Flexible for several toppings.",
          journal_statuses: [],
          proposed_slot: "Monday dinner",
          compatibility: "incomplete_evidence",
          compatibility_caveat: "Ingredients and cross-contact information are incomplete.",
        },
      ],
    };
    let createCalls = 0;
    const createAfterDecision = async (accepted: boolean) => {
      if (!accepted) return null;
      createCalls += 1;
      const response = await handleLocalHouseholdMcpMessage(root, {
        jsonrpc: "2.0",
        id: createCalls,
        method: "tools/call",
        params: {
          name: "fullwell_local_recipe_board_create",
          arguments: boardInput,
        },
      });
      const parsedResponse = LocalMcpResponseSchema.parse(response);
      return RecipeBoardResultSchema.parse(JSON.parse(parsedResponse.result.content[0].text));
    };

    expect(await createAfterDecision(false)).toBeNull();
    expect(createCalls).toBe(0);
    await expect(access(join(root, "fullwell", "local", "views", "recipe-boards"))).rejects.toThrow();

    const board = await createAfterDecision(true);
    expect(board).not.toBeNull();
    if (board === null) throw new Error("Accepted recipe-board handoff did not create a board");
    expect(createCalls).toBe(1);
    expect(board.card_count).toBe(2);

    await page.route(/^https:\/\//, async (route) => await route.abort());
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(board.file_url);
    expect(response?.url()).toBe(board.file_url);
    expect(reportOpenOutcome(response?.url() === board.file_url, board.file_path)).toBe(openedMessage);
    expect(reportOpenOutcome(false, board.file_path)).toContain(fallbackMessage);
    await expect(page.getByRole("heading", { level: 1, name: "Ideas for the week" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(2);
    expect(await page.getByRole("heading", { level: 2 }).allTextContents()).toEqual([
      "Tomato tart",
      "Pizza",
    ]);
    await expect(page.getByRole("img", { name: "Tomato tart" })).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(page.getByRole("img", { name: "No image available for Pizza" })).toBeVisible();
    await expect(page.locator("script, form, iframe, object")).toHaveCount(0);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      "content",
      /default-src 'none'.*connect-src 'none'.*form-action 'none'/,
    );
    await expect(page.getByRole("link", { name: "Open recipe" })).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("link", { name: "Open recipe" })).toHaveAttribute("rel", "noopener noreferrer");

    const columnCount = await page.locator(".recipe-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length);
    if ((page.viewportSize()?.width ?? 0) <= 560) expect(columnCount).toBe(1);
    else if ((page.viewportSize()?.width ?? 0) <= 860) expect(columnCount).toBe(2);
    else expect(columnCount).toBe(3);

    await page.getByRole("link", { name: "Open recipe" }).focus();
    await expect(page.getByRole("link", { name: "Open recipe" })).toBeFocused();
    expect(await page.getByRole("link", { name: "Open recipe" }).evaluate((element) =>
      getComputedStyle(element).outlineWidth)).toBe("3px");
    const animationSeconds = await page.locator("body").evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).animationDuration));
    expect(animationSeconds).toBeLessThanOrEqual(0.00001);

    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByRole("heading", { level: 2, name: "Tomato tart" })).toBeVisible();

    if (testInfo.project.name !== "no-js-webkit") {
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
    }
    await page.screenshot({ path: testInfo.outputPath("private-recipe-board.png"), fullPage: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
