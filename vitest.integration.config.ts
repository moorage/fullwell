import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/server/**/*.integration.test.ts", "tests/integration/**/*.test.ts"],
    passWithNoTests: false,
    testTimeout: 30_000,
  },
});
