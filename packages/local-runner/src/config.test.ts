import { describe, expect, it } from "vitest";
import { defaultApplicationRoot, parseRunnerConfig } from "./config.js";

const valid = {
  public_origin: "https://fullwell.example.test",
  household_id: "hsh_0000000000000001",
  device_id: "dev_0000000000000001",
  host: "claude",
  host_executable: "/usr/local/bin/claude",
  host_project_directory: null,
  retailer_origin: "https://retailer.example.test/",
  application_root: "/tmp/fullwell",
};

describe("parseRunnerConfig", () => {
  it("parses bounded runner configuration", () => {
    expect(parseRunnerConfig(valid)).toMatchObject({ poll_wait_seconds: 20, heartbeat_seconds: 30, host: "claude" });
    expect(defaultApplicationRoot()).toContain("Library/Application Support/Fullwell");
  });

  it("rejects insecure remote origins and retailer paths", () => {
    expect(() => parseRunnerConfig({ ...valid, public_origin: "http://remote.example.test" })).toThrow(/HTTPS/);
    expect(() => parseRunnerConfig({ ...valid, retailer_origin: "http://remote.example.test" })).toThrow(/HTTPS/);
    expect(() => parseRunnerConfig({ ...valid, retailer_origin: "https://retailer.example.test/cart" })).toThrow(/without a path/);
    expect(() => parseRunnerConfig({ ...valid, host: "codex" })).toThrow(/isolated host project/);
    expect(() => parseRunnerConfig({ ...valid, host_project_directory: "/tmp/codex" })).toThrow(/Claude does not use/);
    expect(() => parseRunnerConfig({ ...valid, extra: true })).toThrow();
  });
});
