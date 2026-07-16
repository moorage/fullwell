const target = process.argv[2] ?? "local";
const configuredUrl = target === "staging" ? process.env.STAGING_BASE_URL : process.env.PUBLIC_BASE_URL;
const baseUrl = configuredUrl ?? (target === "local" ? "http://127.0.0.1:4173" : undefined);

if (!baseUrl) {
  throw new Error(`Set ${target === "staging" ? "STAGING_BASE_URL" : "PUBLIC_BASE_URL"} before running the ${target} deploy smoke.`);
}

const checks = [
  ["/health/live", 200],
  ["/health/ready", 200],
  ["/install", 200],
  ["/privacy", 200],
  ["/terms", 200],
  ["/mcp", 401],
];

for (const [path, expectedStatus] of checks) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(10_000) });
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}; expected ${expectedStatus}.`);
  }
}

console.log(`Deployment smoke passed for ${target} at ${baseUrl}.`);
