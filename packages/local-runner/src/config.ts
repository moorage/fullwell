import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  HouseholdIdSchema,
  RunnerDeviceIdSchema,
} from "@hfj/contracts";
import { z } from "zod";

const RunnerBrowserBackendSchema = z.enum(["chrome", "safari"]);
const RunnerHostSchema = z.enum(["codex", "claude"]);

const RunnerConfigSchema = z.object({
  public_origin: z.url(),
  household_id: HouseholdIdSchema,
  device_id: RunnerDeviceIdSchema,
  host: RunnerHostSchema,
  browser_backend: RunnerBrowserBackendSchema,
  host_executable: z.string().startsWith("/").min(2),
  host_project_directory: z.string().startsWith("/").min(2).nullable(),
  retailer_origin: z.url(),
  application_root: z.string().min(1),
  poll_wait_seconds: z.number().int().min(0).max(25).default(20),
  heartbeat_seconds: z.number().int().min(10).max(60).default(30),
}).strict().superRefine((value, context) => {
  const server = new URL(value.public_origin);
  if (server.protocol !== "https:" && server.hostname !== "127.0.0.1" && server.hostname !== "localhost") {
    context.addIssue({ code: "custom", path: ["public_origin"], message: "The runner server must use HTTPS outside localhost" });
  }
  const retailer = new URL(value.retailer_origin);
  if (retailer.protocol !== "https:" && retailer.hostname !== "127.0.0.1" && retailer.hostname !== "localhost") {
    context.addIssue({ code: "custom", path: ["retailer_origin"], message: "The retailer must use HTTPS outside localhost" });
  }
  if (retailer.pathname !== "/" || retailer.search !== "" || retailer.hash !== "") {
    context.addIssue({ code: "custom", path: ["retailer_origin"], message: "The retailer setting must be an origin without a path" });
  }
  if (value.host === "codex" && value.host_project_directory === null) {
    context.addIssue({ code: "custom", path: ["host_project_directory"], message: "Codex requires an isolated host project directory" });
  }
  if (value.host === "claude" && value.host_project_directory !== null) {
    context.addIssue({ code: "custom", path: ["host_project_directory"], message: "Claude does not use a Codex host project directory" });
  }
  if (value.host === "claude" && value.browser_backend === "safari") {
    context.addIssue({ code: "custom", path: ["browser_backend"], message: "Safari requires the Codex Computer Use host; Claude Code supports Chrome only" });
  }
});

export type RunnerConfig = Readonly<z.infer<typeof RunnerConfigSchema>>;
export type RunnerBrowserBackend = z.infer<typeof RunnerBrowserBackendSchema>;
export type RunnerHost = z.infer<typeof RunnerHostSchema>;

export function parseRunnerConfig(input: unknown): RunnerConfig {
  if (typeof input === "object" && input !== null && !("browser_backend" in input)) {
    throw new Error("Runner config has no explicit background browser authorization. Run set-browser with --browser chrome or --browser safari before reinstalling the runner.");
  }
  return RunnerConfigSchema.parse(input);
}

export function parseRunnerBrowserBackend(input: string): RunnerBrowserBackend {
  const parsed = RunnerBrowserBackendSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new Error("--browser must be chrome or safari; Fullwell does not substitute a different browser.");
}

export function parseRunnerHost(input: string, browserBackend: RunnerBrowserBackend): RunnerHost {
  const host = RunnerHostSchema.parse(input);
  if (host === "claude" && browserBackend === "safari") {
    throw new Error("Safari requires the Codex Computer Use host; Claude Code supports Chrome only");
  }
  return host;
}

export function setRunnerBrowserBackend(input: unknown, browserBackend: RunnerBrowserBackend): RunnerConfig {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Runner config must be an object");
  }
  return RunnerConfigSchema.parse({ ...input, browser_backend: browserBackend });
}

export function defaultApplicationRoot(): string {
  return resolve(homedir(), "Library/Application Support/Fullwell");
}
