import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  HouseholdIdSchema,
  RunnerDeviceIdSchema,
} from "@hfj/contracts";
import { z } from "zod";

const RunnerConfigSchema = z.object({
  public_origin: z.url(),
  household_id: HouseholdIdSchema,
  device_id: RunnerDeviceIdSchema,
  host: z.enum(["codex", "claude"]),
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
});

export type RunnerConfig = Readonly<z.infer<typeof RunnerConfigSchema>>;

export function parseRunnerConfig(input: unknown): RunnerConfig {
  return RunnerConfigSchema.parse(input);
}

export function defaultApplicationRoot(): string {
  return resolve(homedir(), "Library/Application Support/Fullwell");
}
