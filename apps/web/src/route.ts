import type { WebRoute } from "./types.js";

export function resolveWebRoute(input: string): WebRoute {
  const url = new URL(input, "https://fullwell.example");
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/" || url.pathname === "/install") {
    return { page: "install", host: url.searchParams.get("host") === "claude" ? "claude" : "codex" };
  }
  if (url.pathname === "/sign-in") {
    return {
      page: "sign-in",
      returnTo: url.searchParams.get("returnTo") ?? undefined,
    };
  }
  if (url.pathname === "/authorize") return { page: "authorize" };
  if (parts[0] === "invite" && parts[1] === "family" && parts[2]) {
    return { page: "invite", token: parts[2] };
  }
  if (parts[0] === "c" && parts[1] && parts[2] === "import" && parts[3] === "plan") {
    return { page: "collection-import-plan", token: parts[1] };
  }
  if (parts[0] === "c" && parts[1] && parts.length === 2) {
    return { page: "collection", token: parts[1] };
  }
  if (url.pathname === "/households") return { page: "households" };
  if (parts[0] === "households" && parts[1] && parts[2] === "members") {
    return { page: "members", householdId: parts[1] };
  }
  if (parts[0] === "households" && parts[1] && parts[2] === "collections") {
    return { page: "collections", householdId: parts[1] };
  }
  if (parts[0] === "households" && parts[1] && parts.length === 2) {
    return { page: "household", householdId: parts[1] };
  }
  if (url.pathname === "/account") return { page: "account" };
  if (url.pathname === "/privacy") return { page: "privacy" };
  if (url.pathname === "/terms") return { page: "terms" };
  return { page: "not-found" };
}
