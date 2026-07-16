const target = process.argv[2] ?? "local";
const configuredUrl = target === "staging" ? process.env.STAGING_BASE_URL : process.env.PUBLIC_BASE_URL;
const baseUrl = configuredUrl ?? (target === "local" ? "http://127.0.0.1:4173" : undefined);
if (!baseUrl) throw new Error(`No base URL configured for ${target}.`);

const resourceMetadata = await fetch(new URL("/.well-known/oauth-protected-resource", baseUrl), {
  signal: AbortSignal.timeout(10_000),
});
if (!resourceMetadata.ok) throw new Error(`Protected-resource metadata returned ${resourceMetadata.status}.`);
const metadata = await resourceMetadata.json();
if (metadata.resource !== new URL("/mcp", baseUrl).href) throw new Error("Protected-resource audience does not match /mcp.");

const unauthorized = await fetch(new URL("/mcp", baseUrl), { signal: AbortSignal.timeout(10_000) });
if (unauthorized.status !== 401) throw new Error(`/mcp returned ${unauthorized.status}; expected 401.`);
if (!unauthorized.headers.get("www-authenticate")?.includes("resource_metadata")) {
  throw new Error("/mcp did not advertise protected-resource metadata.");
}

console.log(`MCP discovery smoke passed for ${target} at ${baseUrl}.`);
