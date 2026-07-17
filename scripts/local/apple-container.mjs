import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const localPostgres = Object.freeze({
  containerName: "hfj-postgres",
  database: "hfj_test",
  envFile: fileURLToPath(new URL("../../.codex/runtime/hfj-postgres.env", import.meta.url)),
  host: "127.0.0.1",
  hostPort: 55_432,
  image: "docker.io/library/postgres:17-alpine",
  label: "com.fullwell.hfj.role=local-postgres",
  labelKey: "com.fullwell.hfj.role",
  labelValue: "local-postgres",
  user: "hfj",
  volumeName: "hfj-postgres-data",
});

export function parseJsonArray(output, source) {
  let value;
  try {
    value = JSON.parse(output);
  } catch {
    throw new Error(`${source} did not return valid JSON.`);
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "object" || entry === null || Array.isArray(entry))) {
    throw new Error(`${source} must return an array of objects.`);
  }
  return value;
}

export function parsePostgresCredentials(content) {
  const entries = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("The local PostgreSQL credential file is malformed.");
    const key = line.slice(0, separator);
    if (entries.has(key)) throw new Error(`The local PostgreSQL credential file repeats ${key}.`);
    entries.set(key, line.slice(separator + 1));
  }
  for (const key of ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"]) {
    if (!entries.get(key)) throw new Error(`The local PostgreSQL credential file is missing ${key}.`);
  }
  return {
    database: entries.get("POSTGRES_DB"),
    password: entries.get("POSTGRES_PASSWORD"),
    user: entries.get("POSTGRES_USER"),
  };
}

export function validateBuildContainerVersion(output) {
  const match = /container CLI version (\d+)\.(\d+)\.(\d+)/.exec(output);
  if (match === null) throw new Error("Unable to determine the Apple Container CLI version.");
  const version = match.slice(1).map(Number);
  const supported = version[0] > 0 || (version[0] === 0 && version[1] >= 12);
  if (!supported) {
    throw new Error(`Apple Container ${version.join(".")} cannot build this image; upgrade to 0.12.0 or newer to avoid the upstream archive defect.`);
  }
  return version.join(".");
}

export function buildPostgresRunArgs(config = localPostgres) {
  return [
    "run",
    "--detach",
    "--name", config.containerName,
    "--label", config.label,
    "--publish", `${config.host}:${config.hostPort}:5432`,
    "--env-file", config.envFile,
    "--env", "PGDATA=/var/lib/postgresql/data/pgdata",
    "--volume", `${config.volumeName}:/var/lib/postgresql/data`,
    "--memory", "1G",
    "--cpus", "2",
    config.image,
  ];
}

export function validateManagedContainer(container, config = localPostgres) {
  const configuration = container.configuration;
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration)) {
    throw new Error(`${config.containerName} has an unreadable Apple Container configuration.`);
  }
  const labels = configuration.labels;
  if (typeof labels !== "object" || labels === null || Array.isArray(labels) || labels[config.labelKey] !== config.labelValue) {
    throw new Error(`${config.containerName} exists but is not managed by this repository.`);
  }
  const ports = configuration.publishedPorts;
  const expectedPort = Array.isArray(ports) && ports.some((port) => (
    typeof port === "object" && port !== null && !Array.isArray(port)
    && port.hostAddress === config.host && port.hostPort === config.hostPort && port.containerPort === 5432
  ));
  if (!expectedPort) throw new Error(`${config.containerName} does not expose PostgreSQL only on ${config.host}:${config.hostPort}.`);
  const state = typeof container.status === "string" ? container.status : container.status?.state;
  if (state !== "running" && state !== "stopped") {
    throw new Error(`${config.containerName} has unsupported status ${String(state)}.`);
  }
  return state;
}

export function hasVolume(volumes, name) {
  return volumes.some((entry) => entry.id === name || entry.name === name || entry.configuration?.name === name);
}

function run(command, args, options = {}) {
  const capture = options.capture === true;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = capture && result.stderr.trim() !== "" ? `\n${result.stderr.trim()}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with status ${String(result.status)}.${detail}`);
  }
  return capture ? result.stdout : "";
}

function assertAppleContainerHost() {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("The local Apple Container harness requires macOS on Apple silicon.");
  }
  return run("container", ["--version"], { capture: true });
}

function listContainers() {
  return parseJsonArray(run("container", ["list", "--all", "--format", "json"], { capture: true }), "container list");
}

function listVolumes() {
  return parseJsonArray(run("container", ["volume", "list", "--format", "json"], { capture: true }), "container volume list");
}

async function readCredentials() {
  return parsePostgresCredentials(await readFile(localPostgres.envFile, "utf8"));
}

async function ensureCredentials(volumeExists) {
  try {
    return await readCredentials();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    if (volumeExists) {
      throw new Error(`The ${localPostgres.volumeName} volume exists without ${localPostgres.envFile}; refusing to generate mismatched credentials.`);
    }
    const credentials = {
      database: localPostgres.database,
      password: randomBytes(32).toString("base64url"),
      user: localPostgres.user,
    };
    await mkdir(new URL("../../.codex/runtime/", import.meta.url), { recursive: true, mode: 0o700 });
    await writeFile(
      localPostgres.envFile,
      `POSTGRES_USER=${credentials.user}\nPOSTGRES_PASSWORD=${credentials.password}\nPOSTGRES_DB=${credentials.database}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await chmod(localPostgres.envFile, 0o600);
    return credentials;
  }
}

export function buildDatabaseUrl(credentials) {
  const url = new URL("postgresql://localhost");
  url.username = credentials.user;
  url.password = credentials.password;
  url.hostname = localPostgres.host;
  url.port = String(localPostgres.hostPort);
  url.pathname = credentials.database;
  return url.href;
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync("container", ["exec", localPostgres.containerName, "pg_isready", "-U", localPostgres.user, "-d", localPostgres.database], {
      encoding: "utf8",
      stdio: "ignore",
    });
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${localPostgres.containerName} did not become ready within 30 seconds.`);
}

async function startPostgres() {
  assertAppleContainerHost();
  run("container", ["system", "start"]);
  const existing = listContainers().find((entry) => entry.configuration?.id === localPostgres.containerName);
  const volumeExists = hasVolume(listVolumes(), localPostgres.volumeName);
  await ensureCredentials(volumeExists);
  if (existing === undefined) {
    if (!volumeExists) run("container", ["volume", "create", "--label", localPostgres.label, localPostgres.volumeName]);
    run("container", buildPostgresRunArgs());
  } else if (validateManagedContainer(existing) === "stopped") {
    run("container", ["start", localPostgres.containerName]);
  }
  await waitForPostgres();
  process.stdout.write(`${localPostgres.containerName} is ready on ${localPostgres.host}:${localPostgres.hostPort}.\n`);
}

function postgresStatus() {
  assertAppleContainerHost();
  run("container", ["system", "status"]);
  const existing = listContainers().find((entry) => entry.configuration?.id === localPostgres.containerName);
  if (existing === undefined) {
    process.stdout.write(`${localPostgres.containerName} does not exist.\n`);
    return;
  }
  process.stdout.write(`${localPostgres.containerName} is ${validateManagedContainer(existing)}.\n`);
}

function stopPostgres() {
  assertAppleContainerHost();
  const existing = listContainers().find((entry) => entry.configuration?.id === localPostgres.containerName);
  if (existing === undefined) {
    process.stdout.write(`${localPostgres.containerName} does not exist.\n`);
    return;
  }
  if (validateManagedContainer(existing) === "running") run("container", ["stop", localPostgres.containerName]);
  process.stdout.write(`${localPostgres.containerName} is stopped; its Apple volume is preserved.\n`);
}

async function verifyPostgres() {
  await startPostgres();
  const credentials = await readCredentials();
  const env = { ...process.env, TEST_DATABASE_URL: buildDatabaseUrl(credentials) };
  run("npm", ["run", "test:migrations"], { env });
  run("npm", ["run", "test:integration"], { env });
}

function buildImage() {
  validateBuildContainerVersion(assertAppleContainerHost());
  run("container", ["system", "start"]);
  run("container", ["build", "--platform", "linux/arm64", "--tag", "household-food-journal:local", "."]);
}

async function main(action) {
  if (action === "system:start") {
    assertAppleContainerHost();
    run("container", ["system", "start"]);
  } else if (action === "postgres:start") {
    await startPostgres();
  } else if (action === "postgres:stop") {
    stopPostgres();
  } else if (action === "postgres:status") {
    postgresStatus();
  } else if (action === "postgres:verify") {
    await verifyPostgres();
  } else if (action === "image:build") {
    buildImage();
  } else {
    throw new Error("Usage: apple-container.mjs <system:start|postgres:start|postgres:stop|postgres:status|postgres:verify|image:build>");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv[2]);
