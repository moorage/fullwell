import type { WebRoute } from "./types.js";
import { z } from "zod";

const OAuthAuthorizationRouteSchema = z.object({
  client_name: z.string().trim().min(1).max(200),
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(2048),
  redirect_uri: z.url().max(4096),
  scope: z.string().min(1).max(512),
  state: z.string().min(16).max(1024),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  resource: z.url().max(4096),
}).strict().transform((value) => ({
  clientName: value.client_name,
  responseType: value.response_type,
  clientId: value.client_id,
  redirectUri: value.redirect_uri,
  scope: value.scope,
  state: value.state,
  codeChallenge: value.code_challenge,
  codeChallengeMethod: value.code_challenge_method,
  resource: value.resource,
}));

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
  if (url.pathname === "/authorize") {
    const authorization = OAuthAuthorizationRouteSchema.safeParse(Object.fromEntries(url.searchParams));
    return authorization.success ? { page: "authorize", authorization: authorization.data } : { page: "authorize" };
  }
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
