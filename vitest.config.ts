import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const root = import.meta.dirname;
const compositionRoots = ["**/src/main.ts", "**/src/cli.ts", "**/src/client.tsx"];
const databaseIntegrationAdapters = [
  "**/src/auth/neon-store.ts",
  "**/src/oauth/neon-store.ts",
  "**/src/persistence/neon.ts",
  "**/src/persistence/neon-operational-store.ts",
];

export default defineConfig({
  test: {
    projects: [
      { test: { name: "contracts", root: resolve(root, "packages/contracts"), include: ["src/**/*.test.ts"], environment: "node" } },
      { test: { name: "server", root: resolve(root, "apps/server"), include: ["src/**/*.test.ts", "src/**/*.integration.test.ts"], environment: "node" } },
      { test: { name: "web", root: resolve(root, "apps/web"), include: ["src/**/*.test.{ts,tsx}"], environment: "jsdom", setupFiles: ["src/test/setup.ts"] } },
      { test: { name: "cross-surface", root, include: ["tests/**/*.test.ts"], environment: "node" } },
    ],
    coverage: {
      all: true,
      exclude: [
        "**/*.config.*",
        "**/dist/**",
        "**/*.d.ts",
        "**/src/index.ts",
        "tests/**",
        ...compositionRoots,
        ...databaseIntegrationAdapters,
      ],
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
    },
    environment: "node",
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
