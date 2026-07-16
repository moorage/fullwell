import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../app.js";
import { parseWebRenderContext } from "../context.js";
import { demoWebContext } from "../fixtures.js";
import { renderWebRoute } from "../server.js";

function renderApp(url: string, context = demoWebContext) {
  return render(<App url={url} context={context} />);
}

describe("web experience", () => {
  it("shows one selected installation host at a time", async () => {
    const user = userEvent.setup();
    renderApp("/install");
    expect(screen.getByRole("button", { name: "Use with Codex" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/codex plugins install/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Use with Claude" }));
    expect(screen.getByText(/claude plugin install/)).toBeVisible();
    expect(screen.queryByText(/codex plugins install/)).not.toBeInTheDocument();
  });

  it("does not accept an invitation when its preview opens", () => {
    renderApp("/invite/family/join-alvarez");
    expect(screen.getByRole("heading", { name: /Maya Alvarez invited you/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Join household" })).not.toBeInTheDocument();
    expect(screen.getByText(/Opening this link does not join/)).toBeVisible();
  });

  it("requires an explicit authenticated invitation action", () => {
    renderApp("/invite/family/join-alvarez", { ...demoWebContext, invite: { ...demoWebContext.invite, state: "authenticated" } });
    const join = screen.getByRole("button", { name: "Join household" });
    expect(join).toBeVisible();
    expect(join.closest("form")).toHaveAttribute("action", "/invite/family/join-alvarez/accept");
  });

  it("selects recipes independently from snacks", async () => {
    const user = userEvent.setup();
    renderApp("/c/summer-table-7Qc9");
    expect(screen.getByText("2 items selected")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Select all recipes" }));
    expect(screen.getByText("3 items selected")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Salt & vinegar almonds/ })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Select all snacks" }));
    expect(screen.getByText("5 items selected")).toBeVisible();
  });

  it("disables import when no collection items are selected", async () => {
    const user = userEvent.setup();
    renderApp("/c/summer-table-7Qc9");
    const recipes = screen.getByRole("checkbox", { name: "Select all recipes" });
    await user.click(recipes);
    await user.click(recipes);
    const snacks = screen.getByRole("checkbox", { name: "Select all snacks" });
    await user.click(snacks);
    await user.click(snacks);
    expect(screen.getByRole("button", { name: /Import selected/ })).toBeDisabled();
  });

  it("keeps the selected items inside the confirmed import form", () => {
    renderApp("/c/summer-table-7Qc9/import/plan");
    const form = screen.getByRole("button", { name: "Confirm import" }).closest("form");
    expect(form).toHaveAttribute("action", "/c/summer-table-7Qc9/import");
    expect(form?.querySelectorAll('input[name="itemIds"]')).toHaveLength(2);
    expect(within(form as HTMLFormElement).getByText("Tomato, mustard & thyme tart")).toBeVisible();
    expect(within(form as HTMLFormElement).getByText(/not marked Cooked or Liked/)).toBeVisible();
  });

  it.each([
    ["/households", "Your households"],
    ["/households/alvarez-home", "Alvarez home"],
    ["/households/alvarez-home/members", "People in Alvarez home"],
    ["/households/alvarez-home/collections", "Collections from Alvarez home"],
    ["/account", "Account"],
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Service"],
  ])("renders the %s route", (url, heading) => {
    renderApp(url);
    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  });

  it("renders resilient HTML forms on the server", () => {
    const collectionHtml = renderToString(<App url="/c/summer-table-7Qc9" context={demoWebContext} />);
    const authenticatedContext = { ...demoWebContext, invite: { ...demoWebContext.invite, state: "authenticated" as const } };
    const inviteHtml = renderToString(<App url="/invite/family/join" context={authenticatedContext} />);
    expect(collectionHtml).toContain('action="/c/summer-table-7Qc9/import/plan"');
    expect(collectionHtml).toContain('name="itemIds"');
    expect(inviteHtml).toContain('action="/invite/family/join/accept"');
  });

  it("returns route HTML and a useful server title", () => {
    const rendered = renderWebRoute("/c/summer-table-7Qc9", demoWebContext);
    expect(rendered.title).toBe("Shared collection");
    expect(rendered.appHtml).toContain("Summer table");
  });

  it("rejects malformed serialized render data", () => {
    expect(() => parseWebRenderContext({ ...demoWebContext, security: { csrfToken: "short", idempotencyPrefix: "short" } })).toThrow();
  });
});
