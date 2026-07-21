import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { CodexHostAdapter } from "../../packages/local-runner/dist/host/codex.js";

const executeFile = promisify(execFile);
if (!process.argv.includes("--fake-retailer")) throw new Error("Use --fake-retailer; live retailer verification is intentionally unsupported");

const [codex, codexFeatures, claude, codexExecutable] = await Promise.all([
  executeFile("codex", ["exec", "--help"], { encoding: "utf8", maxBuffer: 1_048_576 }),
  executeFile("codex", ["features", "list"], { encoding: "utf8", maxBuffer: 1_048_576 }),
  executeFile("claude", ["--help"], { encoding: "utf8", maxBuffer: 1_048_576 }),
  executeFile("/usr/bin/which", ["codex"], { encoding: "utf8", maxBuffer: 16_384 }),
]);

assertIncludes(codex.stdout, "--output-schema", "Codex structured output");
assertIncludes(codex.stdout, "--ignore-rules", "Codex rule isolation");
assertIncludes(codexFeatures.stdout, "computer_use", "Codex Computer Use");
assertIncludes(codexFeatures.stdout, "browser_use", "Codex browser use");
assertIncludes(claude.stdout, "--chrome", "Claude Chrome integration");
assertIncludes(claude.stdout, "--json-schema", "Claude structured output");

const child = spawn(process.execPath, ["tests/fixtures/fake-retailer/server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, FAKE_RETAILER_PORT: "4191" },
  stdio: ["ignore", "pipe", "pipe"],
});
const snapshotDirectory = await mkdtemp(join(tmpdir(), "fullwell-host-fixture-"));
try {
  await once(child.stdout, "data");
  const response = await fetch("http://127.0.0.1:4191/health", { signal: AbortSignal.timeout(2_000) });
  if (!response.ok) throw new Error("Fake retailer health check failed");
  await writeSnapshot(snapshotDirectory);
  const projectDirectory = resolve(process.env.FULLWELL_CODEX_PROJECT_DIR ?? join(homedir(), "Projects/fullwell-isolated-project-env"));
  const host = new CodexHostAdapter(codexExecutable.stdout.trim(), projectDirectory);
  const input = {
    snapshotDirectory,
    message: "We're out of salted cashews, get more",
    retailerOrigin: "http://127.0.0.1:4191/",
    resumeSessionId: null,
    signal: AbortSignal.timeout(10 * 60_000),
  };
  const resolution = await host.resolve(input);
  if (resolution.kind !== "ready_to_act") throw new Error(`Codex did not resolve the fixture item: ${resolution.kind} (${resolution.message})`);
  const actionInput = { ...input, resumeSessionId: resolution.host_session_id, ready: resolution };
  const first = await host.act(actionInput);
  if (first.kind !== "completed") throw new Error(`Codex did not complete the fixture action: ${first.kind} (${first.message})`);
  const second = await host.act({ ...actionInput, resumeSessionId: first.host_session_id });
  if (second.kind !== "completed") throw new Error(`Codex did not complete the fixture replay: ${second.kind} (${second.message})`);
  const cartResponse = await fetch("http://127.0.0.1:4191/api/cart", { signal: AbortSignal.timeout(2_000) });
  const cart = await cartResponse.json();
  if (!cartResponse.ok || cart.quantities?.["salted-cashews"] !== 1) throw new Error("Codex did not preserve the exact cart target");
  process.stdout.write(`${JSON.stringify({ codex: "supported", claude: "supported", fake_retailer: "passed", cart_quantity: 1, duplicate_action: "unchanged", live_cart: "not_run" })}\n`);
} finally {
  child.kill("SIGTERM");
  await once(child, "exit");
  await rm(snapshotDirectory, { recursive: true, force: true });
}

async function writeSnapshot(directory) {
  await Promise.all([
    mkdir(join(directory, "profiles"), { recursive: true, mode: 0o700 }),
    mkdir(join(directory, "snacks/items"), { recursive: true, mode: 0o700 }),
    mkdir(join(directory, "snacks/evidence"), { recursive: true, mode: 0o700 }),
  ]);
  await Promise.all([
    writeFile(join(directory, "FORMAT_VERSION"), "1\n", { encoding: "utf8", mode: 0o600 }),
    writeFile(join(directory, "profiles/snacks.md"), "# Snack profile\n\nSalted cashews are the only recorded cashew preference.\n", { encoding: "utf8", mode: 0o600 }),
    writeFile(join(directory, "snacks/items/cashews.md"), "# Harbor Salted Cashews\n\n- Identity: Harbor Salted Cashews, salted, 12 oz resealable bag\n- Distinct historical orders: 3\n- Last purchased: 2026-07-12\n- Observed store: Market Fixture\n- Retailer locator: /products/salted-cashews\n", { encoding: "utf8", mode: 0o600 }),
    writeFile(join(directory, "snacks/evidence/cashews.json"), `${JSON.stringify({ item: "Harbor Salted Cashews", variant: "Salted", size: "12 oz", distinct_orders: 3, last_purchased: "2026-07-12", retailer_locator: "/products/salted-cashews" })}\n`, { encoding: "utf8", mode: 0o600 }),
  ]);
}

function assertIncludes(output, expected, capability) {
  if (!output.includes(expected)) throw new Error(`${capability} is unavailable in the installed host`);
}
