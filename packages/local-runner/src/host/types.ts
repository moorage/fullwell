import { HostReadyToActSchema, type HostReadyToAct } from "@hfj/contracts";
import { z } from "zod";

const UserMessageSchema = z.string().trim().min(1).max(480);

export { HostReadyToActSchema };

export const HostTerminalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("completed"), message: UserMessageSchema, host_session_id: z.string().min(1).max(256).nullable() }).strict(),
  z.object({ kind: z.literal("needs_input"), message: UserMessageSchema, host_session_id: z.string().min(1).max(256).nullable() }).strict(),
  z.object({ kind: z.literal("blocked"), message: UserMessageSchema, host_session_id: z.string().min(1).max(256).nullable() }).strict(),
  z.object({ kind: z.literal("cancelled"), message: UserMessageSchema, host_session_id: z.string().min(1).max(256).nullable() }).strict(),
]);

export const HostResolutionSchema = z.union([HostReadyToActSchema, HostTerminalSchema]);

export type { HostReadyToAct };
export type HostTerminal = z.infer<typeof HostTerminalSchema>;
export type HostResolution = z.infer<typeof HostResolutionSchema>;

export interface HostResolveInput {
  readonly snapshotDirectory: string;
  readonly message: string;
  readonly retailerOrigin: string;
  readonly resumeSessionId: string | null;
  readonly signal: AbortSignal;
}

export interface HostActInput extends HostResolveInput {
  readonly ready: HostReadyToAct;
}

export interface AgentHostPort {
  resolve(input: HostResolveInput): Promise<HostResolution>;
  act(input: HostActInput): Promise<HostTerminal>;
}
