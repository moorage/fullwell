import { describe, expect, it } from "vitest";
import { runProcess, safeHostEnvironment } from "./process.js";

describe("runProcess", () => {
  it("passes stdin without a shell and captures bounded output", async () => {
    const result = await runProcess({
      command: "/bin/cat",
      args: [],
      cwd: "/tmp",
      stdin: "literal $(whoami)",
      signal: new AbortController().signal,
      timeoutMilliseconds: 1_000,
      maxOutputBytes: 1_024,
      env: {},
    });
    expect(result.stdout).toBe("literal $(whoami)");
    expect(safeHostEnvironment({ HOME: "/home", PATH: "/bin", BROWSER_USE_AVAILABLE_BACKENDS: "chrome", SECRET: "no" })).toEqual({
      HOME: "/home",
      PATH: "/bin",
      BROWSER_USE_AVAILABLE_BACKENDS: "chrome",
    });
  });

  it("fails on timeout, cancellation, output overflow, and nonzero exit", async () => {
    const base = { cwd: "/tmp", stdin: "", timeoutMilliseconds: 1_000, maxOutputBytes: 10_000, env: {} };
    await expect(runProcess({ ...base, command: "/bin/sleep", args: ["2"], timeoutMilliseconds: 10, signal: new AbortController().signal })).rejects.toThrow(/timed out/);
    const controller = new AbortController();
    controller.abort();
    await expect(runProcess({ ...base, command: "/bin/cat", args: [], signal: controller.signal })).rejects.toThrow(/before launch/);
    await expect(runProcess({ ...base, command: "/usr/bin/yes", args: [], maxOutputBytes: 32, signal: new AbortController().signal })).rejects.toThrow(/size limit/);
    await expect(runProcess({ ...base, command: "/usr/bin/false", args: [], signal: new AbortController().signal })).rejects.toThrow(/unsuccessfully/);
    const started = Date.now();
    await expect(runProcess({
      ...base,
      command: process.execPath,
      args: ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
      timeoutMilliseconds: 10,
      signal: new AbortController().signal,
    })).rejects.toThrow(/timed out/);
    expect(Date.now() - started).toBeLessThan(1_500);
  });

  it("rejects a child stdin pipe failure without emitting an unhandled error", async () => {
    await expect(runProcess({
      command: process.execPath,
      args: ["-e", "process.stdin.destroy();setTimeout(()=>process.exit(0),50)"],
      cwd: "/tmp",
      stdin: "x".repeat(1_000_000),
      signal: new AbortController().signal,
      timeoutMilliseconds: 1_000,
      maxOutputBytes: 1_024,
      env: {},
    })).rejects.toMatchObject({ code: "EPIPE" });
  });
});
