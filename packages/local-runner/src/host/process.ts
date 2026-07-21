import { spawn } from "node:child_process";

export interface ProcessInvocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly stdin: string;
  readonly signal: AbortSignal;
  readonly timeoutMilliseconds: number;
  readonly maxOutputBytes: number;
  readonly env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcessRunner = (invocation: ProcessInvocation) => Promise<ProcessResult>;

export async function runProcess(invocation: ProcessInvocation): Promise<ProcessResult> {
  if (invocation.signal.aborted) throw new Error("Agent host invocation was cancelled before launch");
  return await new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(invocation.command, [...invocation.args], {
      cwd: invocation.cwd,
      env: invocation.env ?? safeHostEnvironment(),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let failure: Error | null = null;
    let forceKill: NodeJS.Timeout | undefined;
    const terminate = (error: Error) => {
      if (failure !== null) return;
      failure = error;
      child.kill("SIGTERM");
      forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
    };
    const append = (current: Buffer<ArrayBufferLike>, chunk: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> => {
      const next = Buffer.concat([current, chunk]);
      if (next.byteLength > invocation.maxOutputBytes) terminate(new Error("Agent host output exceeded its size limit"));
      return next.subarray(0, invocation.maxOutputBytes);
    };
    child.stdout.on("data", (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.once("error", (error) => { failure ??= error; });
    const abort = () => terminate(new Error("Agent host invocation was cancelled"));
    invocation.signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => terminate(new Error("Agent host invocation timed out")), invocation.timeoutMilliseconds);
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (forceKill !== undefined) clearTimeout(forceKill);
      invocation.signal.removeEventListener("abort", abort);
      if (failure !== null) reject(failure);
      else if (code !== 0) reject(new Error(`Agent host exited unsuccessfully (${code ?? signal ?? "unknown"})`));
      else resolve({ stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8") });
    });
    child.stdin.end(invocation.stdin, "utf8");
  });
}

export function safeHostEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const allowed = ["HOME", "PATH", "TMPDIR", "LANG", "LC_ALL", "CODEX_HOME", "CLAUDE_CONFIG_DIR", "BROWSER_USE_AVAILABLE_BACKENDS"] as const;
  return Object.fromEntries(allowed.flatMap((name) => source[name] === undefined ? [] : [[name, source[name]]]));
}
