import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { App } from "../app.js";
import { parseWebRenderContext } from "../context.js";
import { demoWebContext, groceryVisualJournalFixture, recipeVisualJournalFixture } from "../fixtures.js";
import { renderWebRoute } from "../server.js";

function renderApp(url: string, context = demoWebContext) {
  return render(<App url={url} context={context} />);
}

describe("web experience", () => {
  it("shows one selected installation host at a time", async () => {
    const user = userEvent.setup();
    renderApp("/install");
    expect(screen.getByRole("button", { name: "Use with ChatGPT" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/codex plugin add fullwell@fullwell/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Start Fullwell setup" })).toHaveAttribute("href", demoWebContext.install.hosts.codex.setupHref);
    expect(screen.getByText("@Fullwell hi")).toBeVisible();
    expect(screen.getByText(/Start locally without an account/)).toBeVisible();
    expect(screen.getByText(/No account is required to start/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Explore advanced agent guides" })).toHaveAttribute("href", "/guides");
    await user.click(screen.getByRole("button", { name: "Use with Claude" }));
    expect(screen.getByText(/claude plugin install fullwell@fullwell/)).toBeVisible();
    expect(screen.queryByText(/codex plugin add fullwell@fullwell/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start Fullwell setup" })).not.toBeInTheDocument();
    expect(screen.getByText("Set up Fullwell.")).toBeVisible();
  });

  it("reports install-command copy success and failure", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderApp("/install");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Use with Claude" }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => { throw new Error("clipboard unavailable"); }) } });
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("status")).toHaveTextContent("Copy failed");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });

  it("copies the conversational setup prompt separately from the install command", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderApp("/install");
    await user.click(screen.getByRole("button", { name: "Copy prompt" }));
    expect(writeText).toHaveBeenCalledWith("@Fullwell hi");
  });

  it("reports a setup-prompt copy failure without hiding the manual prompt", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => { throw new Error("clipboard unavailable"); }) },
    });
    renderApp("/install");
    await user.click(screen.getByRole("button", { name: "Copy prompt" }));
    expect(screen.getByRole("status")).toHaveTextContent("Select the setup prompt instead");
    expect(screen.getByText("@Fullwell hi")).toBeVisible();
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
    ["/sign-in?returnTo=%2Fc%2Fshare", "Sign in to Fullwell"],
    ["/guides", "Do more with Fullwell in chat"],
    ["/guides/whatsapp", "Connect WhatsApp"],
    ["/guides/household-invitations", "Invite household members"],
    ["/guides/collections/create", "Create a collection"],
    ["/guides/collections/share", "Share a collection"],
    ["/authorize", "Authorization request unavailable"],
    ["/households", "Your households"],
    ["/households/alvarez-home", "Alvarez home"],
    ["/households/alvarez-home/meal-plan?week=2026-07-20", "Meals for July 20–26"],
    ["/households/alvarez-home/members", "People in Alvarez home"],
    ["/households/alvarez-home/collections", "Collections from Alvarez home"],
    ["/account", "Account"],
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Service"],
    ["/missing", "Page not found"],
  ])("renders the %s route", (url, heading) => {
    renderApp(url);
    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  });

  it("links each advanced workflow to its own guide and keeps agent names visible beside marks", () => {
    renderApp("/guides");
    expect(screen.getByRole("link", { name: "Connect WhatsApp" })).toHaveAttribute("href", "/guides/whatsapp");
    expect(screen.getByRole("link", { name: "Invite household members" })).toHaveAttribute("href", "/guides/household-invitations");
    expect(screen.getByRole("link", { name: "Create a collection" })).toHaveAttribute("href", "/guides/collections/create");
    expect(screen.getByRole("link", { name: "Share a collection" })).toHaveAttribute("href", "/guides/collections/share");
    expect(screen.getAllByLabelText("Works with ChatGPT and Claude")).toHaveLength(4);

    renderApp("/guides/collections/share");
    expect(screen.getByText("“Share my Weeknight favorites collection for 7 days.”")).toBeVisible();
    expect(screen.getByRole("link", { name: "Use with ChatGPT" })).toHaveAttribute("href", "/install?host=codex");
    expect(screen.getByRole("link", { name: "Use with Claude" })).toHaveAttribute("href", "/install?host=claude");
  });

  it("uses the Apple mark in sign-in and routes household help to the relevant guides", () => {
    const signIn = renderApp("/sign-in");
    expect(screen.getByRole("button", { name: "Continue with Apple" }).querySelector("svg")).not.toBeNull();
    signIn.unmount();

    const members = renderApp("/households/alvarez-home/members");
    expect(screen.getByRole("link", { name: "See the household invitation guide" })).toHaveAttribute("href", "/guides/household-invitations");
    members.unmount();

    renderApp("/households/alvarez-home/collections");
    expect(screen.getByRole("link", { name: "Create guide" })).toHaveAttribute("href", "/guides/collections/create");
    expect(screen.getByRole("link", { name: "Sharing guide" })).toHaveAttribute("href", "/guides/collections/share");
  });

  it("renders visual recipe cards and progressively appends a deduplicated journal batch", async () => {
    const user = userEvent.setup();
    const initialPage = { ...recipeVisualJournalFixture, items: recipeVisualJournalFixture.items.slice(0, 12), nextCursor: "v1_12" };
    const finalItems = recipeVisualJournalFixture.items.slice(12);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ...recipeVisualJournalFixture,
      items: [initialPage.items[0], ...finalItems],
      nextCursor: null,
    }), { status: 200, headers: { "content-type": "application/json" } })));
    renderApp("/households/alvarez-home/recipes", { ...demoWebContext, visualJournal: initialPage });

    expect(screen.getByRole("heading", { name: "Recipes in Alvarez home" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Load more recipes" })).toHaveAttribute("href", "?page=2");
    const image = document.querySelector(".visual-journal-card__media img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    await user.click(screen.getByRole("link", { name: "Load more recipes" }));
    expect(await screen.findByRole("heading", { name: "Strawberry cornmeal cake" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 2, name: "Tomato, mustard & thyme tart" })).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("reached the end");
  });

  it("keeps an explicit retry when an infinite-scroll batch fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    renderApp("/households/alvarez-home/recipes", {
      ...demoWebContext,
      visualJournal: { ...recipeVisualJournalFixture, items: recipeVisualJournalFixture.items.slice(0, 12), nextCursor: "v1_12" },
    });
    await user.click(screen.getByRole("link", { name: "Load more recipes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("More recipes could not be loaded");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("renders groceries as recorded-only visual cards with intentional missing-image fallbacks", () => {
    renderApp("/households/alvarez-home/groceries", { ...demoWebContext, visualJournal: groceryVisualJournalFixture });
    expect(screen.getByRole("heading", { name: "Groceries in Alvarez home" })).toBeVisible();
    expect(screen.getByText("Black sesame buns").closest("article")).toHaveTextContent("No image recorded");
    expect(screen.getByText(/does not infer brands, products, or categories/)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("reached the end");
  });

  it("keeps same-slot proposals visible and exposes ordinary no-JavaScript meal forms", () => {
    renderApp("/households/alvarez-home/meal-plan?week=2026-07-20");
    const mondayLunch = screen.getByRole("region", { name: "Monday, July 20 lunch" });
    expect(within(mondayLunch).getByRole("heading", { name: "Egg salad sandwich" })).toBeVisible();
    expect(within(mondayLunch).getByRole("heading", { name: "Pizza" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 2, name: /day,/ })).toHaveLength(7);
    expect(screen.getByText("Constraints reviewed for this week")).toBeVisible();
    const add = screen.getByRole("button", { name: "Add meal idea" }).closest("form");
    expect(add).toHaveAttribute("method", "post");
    expect(add).toHaveAttribute("action", "/households/alvarez-home/meal-plan/proposals");
    expect(add).toHaveFormValues({
      csrf: demoWebContext.security.csrfToken,
      week: "2026-07-20",
      constraintRevision: demoWebContext.mealPlan?.constraintRevision,
      constraintReviewEventId: demoWebContext.mealPlan?.constraintReviewEventId,
    });
    expect(screen.getByText("Needs review against the current household constraints")).toBeVisible();
  });

  it("focuses and announces the post/redirect/get meal-plan result", () => {
    renderApp("/households/alvarez-home/meal-plan?week=2026-07-20&changed=proposal-added", {
      ...demoWebContext,
      mealPlan: demoWebContext.mealPlan === null ? null : {
        ...demoWebContext.mealPlan,
        statusMessage: "Meal idea added to the selected date and slot.",
      },
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Meal idea added to the selected date and slot.");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveAttribute("tabindex", "-1");
  });

  it("renders a complete empty week and keeps viewers read-only", () => {
    const mealPlan = demoWebContext.mealPlan;
    if (mealPlan === null) throw new Error("meal plan fixture missing");
    renderApp("/households/alvarez-home/meal-plan?week=2026-07-20", {
      ...demoWebContext,
      households: demoWebContext.households.map((household) =>
        household.id === "alvarez-home" ? { ...household, role: "viewer" as const } : household),
      mealPlan: {
        ...mealPlan,
        canEdit: false,
        proposalCount: 0,
        days: mealPlan.days.map((day) => ({
          ...day,
          slots: day.slots.map((slot) => ({ ...slot, proposals: [] })),
        })),
      },
    });
    expect(screen.getByText("No meals have been proposed yet.")).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 2, name: /day,/ })).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "Add meal idea" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Withdraw/ })).not.toBeInTheDocument();
    expect(screen.getByText("You can view this week, but only household owners and editors can change it.")).toBeVisible();
  });

  it("renders an actionable OAuth consent handoff with exact hidden fields", () => {
    const query = new URLSearchParams({
      client_name: "Codex",
      response_type: "code",
      client_id: "client-1",
      redirect_uri: "http://127.0.0.1:1455/callback",
      scope: "journal:read journal:write runner:messages",
      state: "state-value-0001",
      code_challenge: "c".repeat(43),
      code_challenge_method: "S256",
      resource: "https://journal.example.test/mcp",
    });
    renderApp(`/authorize?${query}`);
    const allow = screen.getByRole("button", { name: "Allow Codex" });
    const form = allow.closest("form");
    expect(form).toHaveAttribute("action", "/oauth/authorize");
    expect(form).toHaveFormValues({
      client_id: "client-1",
      redirect_uri: "http://127.0.0.1:1455/callback",
      scope: "journal:read journal:write runner:messages",
      csrf_token: demoWebContext.security.csrfToken,
      approve: "true",
    });
    expect(screen.getByText("Add evidence and update journal entries")).toBeVisible();
    expect(screen.getByText("Receive linked restocking requests on this Mac")).toBeVisible();
  });

  it("renders passkey, email-sent, and unavailable public states from server context", () => {
    renderApp("/sign-in?returnTo=%2Fc%2Fshare", {
      ...demoWebContext,
      emailSent: true,
      auth: { ...demoWebContext.auth, passkeysEnabled: true, passkeys: [] },
    });
    expect(screen.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
    expect(screen.getByText("Check your email")).toBeVisible();
    expect(screen.getAllByDisplayValue("/c/share")).toHaveLength(2);

    renderApp("/c/unavailable", { ...demoWebContext, collectionState: "unavailable" });
    expect(screen.getByRole("heading", { name: "We could not open this collection" })).toBeVisible();

    renderApp("/c/unavailable/import/plan", { ...demoWebContext, collectionState: "revoked" });
    expect(screen.getByRole("heading", { name: "This collection is no longer shared" })).toBeVisible();
  });

  it("discloses the WhatsApp transport and local restocking boundary", () => {
    renderApp("/privacy");
    expect(screen.getByRole("heading", { name: "WhatsApp restocking" })).toBeVisible();
    expect(screen.getByText(/Meta carries your request/)).toBeVisible();
    expect(screen.getByText(/Product reasoning and approved-retailer cart control happen locally/)).toBeVisible();
  });

  it("renders the current meal-planning privacy boundaries", () => {
    renderApp("/privacy");
    expect(screen.getByText("Effective July 24, 2026")).toBeVisible();
    expect(screen.getByText(/Connected household members can see the shared meal-planning constraint profile/)).toBeVisible();
    expect(screen.getByText(/asks separately before sending allergy or sensitivity terms to a search provider/)).toBeVisible();
    expect(screen.getByText(/Recipe images load directly from their named source hosts/)).toBeVisible();
    expect(screen.getByText(/Any optional weekly meal-planning task belongs to Codex or Claude, not Fullwell/)).toBeVisible();
  });

  it.each([
    ["expired", "The invitation expired"],
    ["revoked", "The invitation was withdrawn"],
  ] as const)("renders the %s invitation terminal state", (state, notice) => {
    renderApp("/invite/family/terminal", { ...demoWebContext, invite: { ...demoWebContext.invite, state } });
    expect(screen.getByRole("heading", { name: "This invitation is no longer available" })).toBeVisible();
    expect(screen.getByText(notice)).toBeVisible();
  });

  it("renders joined invitations with and without a household destination", () => {
    renderApp("/invite/family/joined", { ...demoWebContext, invite: { ...demoWebContext.invite, state: "joined" } });
    expect(screen.getByRole("link", { name: "Open household" })).toHaveAttribute("href", expect.stringMatching(/^\/households\//));
    renderApp("/invite/family/joined", { ...demoWebContext, households: [], invite: { ...demoWebContext.invite, state: "joined" } });
    expect(screen.getAllByRole("link", { name: "Open household" }).at(-1)).toHaveAttribute("href", "/households");
  });

  it("renders default sign-in, initial Claude install, expired collections, and missing households", () => {
    renderApp("/sign-in", { ...demoWebContext, emailSent: false, auth: { ...demoWebContext.auth, passkeysEnabled: false, passkeys: [] } });
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
    expect(screen.queryByText(/return to what you were doing/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with a passkey" })).not.toBeInTheDocument();

    renderApp("/install?host=claude");
    expect(screen.getByText(/claude plugin install fullwell@fullwell/)).toBeVisible();
    renderApp("/c/expired", { ...demoWebContext, collectionState: "expired" });
    expect(screen.getByRole("heading", { name: "This collection has expired" })).toBeVisible();

    for (const url of ["/households/missing", "/households/missing/members", "/households/missing/collections"]) {
      renderApp(url);
    }
    expect(screen.getAllByRole("heading", { name: "Page not found" })).toHaveLength(3);
  });

  it("hides owner-only member controls from non-owners and renders collection status actions", () => {
    const viewerContext = {
      ...demoWebContext,
      households: demoWebContext.households.map((household) => ({ ...household, role: "viewer" as const })),
      members: demoWebContext.members.map((member) => ({ ...member, isCurrentUser: false })),
      collections: [
        { id: "published", title: "Published", itemCount: 1, status: "published" as const, detail: "Live", publicUrl: "https://journal.example.test/c/live" },
        { id: "private", title: "Private", itemCount: 1, status: "private" as const, detail: "Private" },
        { id: "expired", title: "Expired", itemCount: 1, status: "expired" as const, detail: "Inactive" },
      ],
    };
    renderApp(`/households/${viewerContext.households[0]?.id}/members`, viewerContext);
    expect(screen.queryByText("Invite a family member")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save role" })).not.toBeInTheDocument();
    renderApp(`/households/${viewerContext.households[0]?.id}/collections`, viewerContext);
    expect(screen.getByRole("link", { name: "Preview" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Revoke link" })).toBeVisible();
  });

  it("uses the anonymous account label when no display name is available", () => {
    renderApp("/account", { ...demoWebContext, viewer: { ...demoWebContext.viewer, displayName: "" } });
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Fullwell member");
  });

  it("renders account lifecycle forms with CSRF-bound provider linking and destructive confirmations", () => {
    renderApp("/account", { ...demoWebContext, auth: { ...demoWebContext.auth, methods: [] } });
    const addEmail = screen.getByRole("button", { name: "Add email" }).closest("form");
    const addApple = screen.getByRole("button", { name: "Add Apple" }).closest("form");
    expect(addEmail).toHaveAttribute("action", "/account/sign-in-methods/magic_link/start");
    expect(addApple).toHaveAttribute("action", "/account/sign-in-methods/apple/start");
    expect(addEmail?.querySelector('input[name="csrf"]')).toHaveValue(demoWebContext.security.csrfToken);
    expect(screen.getAllByPlaceholderText("Type LEAVE")).toHaveLength(demoWebContext.households.length);
    expect(screen.getAllByPlaceholderText("Type LEAVE")[0]).toHaveAttribute("name", "confirmation");
    expect(screen.getByRole("heading", { name: "Household exports" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Download ZIP" })).toHaveLength(demoWebContext.households.length);
    expect(screen.getAllByRole("button", { name: /history bundle/ })).toHaveLength(demoWebContext.households.length);
    expect(screen.getAllByDisplayValue("readable_zip")[0]?.closest("form")).toHaveAttribute("action", expect.stringMatching(/\/account\/households\/.*\/exports/));
    expect(screen.getByRole("button", { name: "Delete account" }).closest("form")).toHaveAttribute("action", "/account/delete");
  });

  it("renders two-sided WhatsApp setup, confirmation, and revocation states", () => {
    const rendered = renderApp("/account", {
      ...demoWebContext,
      messaging: {
        kind: "setup", availableThroughLabel: "Sep 30, 2026", deviceId: "dev_0000000000000001",
        householdId: demoWebContext.households[0]?.id ?? "hsh_0000000000000001", deviceName: "Kitchen Mac",
      },
    });
    const link = screen.getByRole("button", { name: "Link WhatsApp" }).closest("form");
    expect(link).toHaveAttribute("action", "/account/messaging/whatsapp/link");
    expect(link?.querySelector('input[name="csrf"]')).toHaveValue(demoWebContext.security.csrfToken);

    rendered.rerender(<App url="/account" context={{
      ...demoWebContext,
      messaging: {
        kind: "pending_confirmation", availableThroughLabel: "Sep 30, 2026", linkId: "lnk_0000000000000001",
        deviceId: "dev_0000000000000001", householdId: demoWebContext.households[0]?.id ?? "hsh_0000000000000001",
        deviceName: "Kitchen Mac", confirmationExpiresLabel: "Jul 20, 2026",
      },
    }} />);
    expect(screen.getByRole("button", { name: "Confirm connection" }).closest("form")).toHaveAttribute("action", "/account/messaging/whatsapp/confirm");

    rendered.rerender(<App url="/account" context={{
      ...demoWebContext,
      messaging: {
        kind: "linked", availableThroughLabel: "Sep 30, 2026", deviceId: "dev_0000000000000001",
        householdId: demoWebContext.households[0]?.id ?? "hsh_0000000000000001", deviceName: "Kitchen Mac", lastSeenLabel: null,
      },
    }} />);
    const messagingSection = screen.getByRole("heading", { name: "WhatsApp" }).closest("section");
    if (messagingSection === null) throw new Error("WhatsApp section was not rendered");
    const revoke = within(messagingSection).getByRole("button", { name: "Revoke" }).closest("form");
    expect(revoke).toHaveAttribute("action", "/account/messaging/whatsapp/revoke");
    expect(revoke?.querySelector('input[name="confirmation"]')).toHaveAttribute("placeholder", "Type REVOKE");
  });

  it("renders enrolled passkeys with CSRF-bound removal and enrollment controls", () => {
    renderApp("/account", {
      ...demoWebContext,
      auth: {
        ...demoWebContext.auth,
        passkeysEnabled: true,
        passkeys: [{ id: "credential_41", name: "Passkey", createdLabel: "Jul 15, 2026", lastUsedLabel: "Jul 16, 2026" }],
      },
    });
    expect(screen.getByRole("heading", { name: "Passkeys" })).toBeVisible();
    expect(screen.getByText(/Added Jul 15, 2026/)).toBeVisible();
    const remove = screen.getAllByRole("button", { name: "Remove" })
      .map((button) => button.closest("form"))
      .find((form) => form?.getAttribute("action") === "/auth/passkeys/credential_41/remove");
    expect(remove).toHaveAttribute("action", "/auth/passkeys/credential_41/remove");
    expect(remove?.querySelector('input[name="csrf"]')).toHaveValue(demoWebContext.security.csrfToken);
    expect(screen.getByRole("button", { name: "Add a passkey" })).toBeVisible();
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
    expect(() => parseWebRenderContext({
      ...demoWebContext,
      install: { hosts: { ...demoWebContext.install.hosts, codex: { ...demoWebContext.install.hosts.codex, setupHref: "https://attacker.example/new" } } },
    })).toThrow("Only Codex new-conversation URLs are accepted");
  });
});
