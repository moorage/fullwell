import { describe, expect, it } from "vitest";
import { resolveWebRoute } from "../route.js";

describe("resolveWebRoute", () => {
  it.each([
    ["/", { page: "install", host: "codex" }],
    ["/install?host=claude", { page: "install", host: "claude" }],
    ["/sign-in?sent=1&returnTo=%2Fc%2Fshare", { page: "sign-in", returnTo: "/c/share" }],
    ["/authorize", { page: "authorize" }],
    ["/invite/family/join-me?state=authenticated", { page: "invite", token: "join-me" }],
    ["/c/share?state=revoked", { page: "collection", token: "share" }],
    ["/c/share/import/plan", { page: "collection-import-plan", token: "share" }],
    ["/households", { page: "households" }],
    ["/households/home", { page: "household", householdId: "home" }],
    ["/households/home/members", { page: "members", householdId: "home" }],
    ["/households/home/collections", { page: "collections", householdId: "home" }],
    ["/account", { page: "account" }],
    ["/privacy", { page: "privacy" }],
    ["/terms", { page: "terms" }],
    ["/missing", { page: "not-found" }],
  ])("maps %s", (url, expected) => {
    expect(resolveWebRoute(url)).toEqual(expected);
  });

  it("does not let query parameters choose server-owned state", () => {
    expect(resolveWebRoute("/invite/family/join-me?state=authenticated")).toEqual({ page: "invite", token: "join-me" });
    expect(resolveWebRoute("/c/share?state=revoked")).toEqual({ page: "collection", token: "share" });
  });

  it("parses a complete validated OAuth consent handoff", () => {
    const query = new URLSearchParams({
      client_name: "Codex",
      response_type: "code",
      client_id: "client-1",
      redirect_uri: "http://127.0.0.1:1455/callback",
      scope: "journal:read journal:write",
      state: "state-value-0001",
      code_challenge: "c".repeat(43),
      code_challenge_method: "S256",
      resource: "https://journal.example.test/mcp",
    });
    expect(resolveWebRoute(`/authorize?${query}`)).toEqual({
      page: "authorize",
      authorization: {
        clientName: "Codex",
        responseType: "code",
        clientId: "client-1",
        redirectUri: "http://127.0.0.1:1455/callback",
        scope: "journal:read journal:write",
        state: "state-value-0001",
        codeChallenge: "c".repeat(43),
        codeChallengeMethod: "S256",
        resource: "https://journal.example.test/mcp",
      },
    });
  });
});
