import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { z } from "zod";
import type { KeychainPort } from "./keychain.js";

const executeFile = promisify(execFile);
const ClientRegistrationSchema = z.object({ client_id: z.string().min(1).max(2_048) }).passthrough();
const TokenResponseSchema = z.object({
  access_token: z.string().min(1).max(4_096),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(32).max(4_096),
  scope: z.string(),
}).passthrough();

export interface NativeConnectOptions {
  readonly origin: URL;
  readonly keychain: KeychainPort;
  readonly fetcher?: typeof fetch;
  readonly openBrowser?: (url: URL) => Promise<void>;
  readonly timeoutMilliseconds?: number;
}

export async function connectNativeRunner(options: NativeConnectOptions): Promise<{ readonly accessToken: string; readonly clientId: string }> {
  const fetcher = options.fetcher ?? fetch;
  const openBrowser = options.openBrowser ?? openSystemBrowser;
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  let callbackResolve: ((code: string) => void) | null = null;
  let callbackReject: ((error: Error) => void) | null = null;
  const callback = new Promise<string>((resolve, reject) => {
    callbackResolve = resolve;
    callbackReject = reject;
  });
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname !== "/oauth/callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    if (requestUrl.searchParams.get("state") !== state) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Fullwell authorization state did not match.");
      callbackReject?.(new Error("OAuth authorization state did not match"));
      return;
    }
    const code = requestUrl.searchParams.get("code");
    if (code === null) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Fullwell authorization was not completed.");
      callbackReject?.(new Error("OAuth authorization did not return a code"));
      return;
    }
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("Fullwell is connected. You can close this tab.");
    callbackResolve?.(code);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Unable to allocate the local OAuth callback");
    const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`;
    const registered = await fetcher(new URL("/oauth/register", options.origin), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Fullwell local runner",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        application_type: "native",
        scope: "journal:read runner:messages",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!registered.ok) throw new Error(`Fullwell client registration failed with status ${registered.status}`);
    const client = ClientRegistrationSchema.parse(await registered.json());
    const resource = new URL("/mcp", options.origin).toString();
    const authorization = new URL("/oauth/authorize", options.origin);
    authorization.search = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: redirectUri,
      scope: "journal:read runner:messages",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource,
    }).toString();
    const [, code] = await Promise.all([
      openBrowser(authorization),
      withTimeout(callback, options.timeoutMilliseconds ?? 5 * 60_000),
    ]);
    const tokenResponse = await fetcher(new URL("/oauth/token", options.origin), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        resource,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new Error(`Fullwell token exchange failed with status ${tokenResponse.status}`);
    const tokens = TokenResponseSchema.parse(await tokenResponse.json());
    const scopes = new Set(tokens.scope.split(" ").filter(Boolean));
    if (!scopes.has("journal:read") || !scopes.has("runner:messages")) throw new Error("Fullwell did not grant the required runner permissions");
    await Promise.all([
      options.keychain.write("oauth-client-id", client.client_id),
      options.keychain.write("oauth-refresh-token", tokens.refresh_token),
    ]);
    return { accessToken: tokens.access_token, clientId: client.client_id };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  }
}

async function openSystemBrowser(url: URL): Promise<void> {
  await executeFile("/usr/bin/open", [url.toString()], { encoding: "utf8", maxBuffer: 16_384 });
}

async function withTimeout<T>(operation: Promise<T>, timeoutMilliseconds: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("Fullwell browser authorization timed out")), timeoutMilliseconds);
  });
  try {
    return await Promise.race([operation, expired]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
