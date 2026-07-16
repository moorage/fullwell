import type { HouseholdRepositoryPort, OperationalStorePort } from "../core/ports.js";

export interface ReadinessReport {
  readonly ready: boolean;
  readonly checks: {
    readonly operational_store: { ready: boolean; detail: string };
    readonly git: { ready: boolean; detail: string };
  };
}

export class HealthService {
  constructor(private readonly store: OperationalStorePort, private readonly repository: HouseholdRepositoryPort) {}

  async readiness(): Promise<ReadinessReport> {
    const operational = await this.store.health();
    const git = await gitAvailable();
    return { ready: operational.ready && git.ready, checks: { operational_store: operational, git } };
  }
}

async function gitAvailable(): Promise<{ ready: boolean; detail: string }> {
  const { spawn } = await import("node:child_process");
  return await new Promise((resolve) => {
    const child = spawn("git", ["--version"], { shell: false, stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", () => resolve({ ready: false, detail: "unavailable" }));
    child.on("close", (code) => resolve(code === 0 ? { ready: true, detail: Buffer.concat(chunks).toString("utf8").trim() } : { ready: false, detail: "failed" }));
  });
}
