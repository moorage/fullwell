import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "artifacts/playwright",
  reporter: [["list"], ["html", { open: "never", outputFolder: "artifacts/playwright-report" }]],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4187",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run build && PORT=4187 PUBLIC_ORIGIN=http://127.0.0.1:4187 AUTH_MODE=test npm run dev",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:4187/health/live",
    },
    {
      command: "node tests/fixtures/fake-retailer/server.mjs",
      reuseExistingServer: true,
      timeout: 30_000,
      url: "http://127.0.0.1:4289/health",
    },
  ],
  projects: [
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
    { name: "narrow-webkit", use: { browserName: "webkit", viewport: { width: 320, height: 568 } } },
    { name: "no-js-webkit", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, javaScriptEnabled: false } },
  ],
});
