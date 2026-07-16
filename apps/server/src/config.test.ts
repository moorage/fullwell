import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
  it("requires production secrets and separate Neon URLs", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow(/forbidden/);
    expect(() => parseConfig({ NODE_ENV: "production", AUTH_MODE: "session" })).toThrow(/incomplete/);
    expect(() => parseConfig({ NODE_ENV: "test", DATABASE_URL: "postgres://localhost/db" })).toThrow(/configured together/);
  });

  it("provides deterministic local defaults", () => {
    expect(parseConfig({ NODE_ENV: "test", PATH: "/usr/bin", HOME: "/tmp" })).toMatchObject({ PORT: 3000, AUTH_MODE: "test", EXPORT_ROOT: "./.data/exports" });
  });

  it("loads secrets from systemd credential files", () => {
    const directory = mkdtempSync(join(tmpdir(), "hfj-config-"));
    try {
      const pepper = join(directory, "pepper");
      writeFileSync(pepper, "a-secure-pepper-value-that-is-long-enough\n", { mode: 0o600 });
      expect(parseConfig({ NODE_ENV: "test", TOKEN_PEPPER_FILE: pepper }).TOKEN_PEPPER).toBe("a-secure-pepper-value-that-is-long-enough");
      expect(() => parseConfig({ NODE_ENV: "test", TOKEN_PEPPER: "inline-value-that-is-long-enough-000", TOKEN_PEPPER_FILE: pepper })).toThrow(/mutually exclusive/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
