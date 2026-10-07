import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/codexplain_test",
  DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/codexplain_test",
  NEXTAUTH_URL: `http://localhost:${PORT}`,
  NEXTAUTH_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
  GITHUB_ID: "e2e",
  GITHUB_SECRET: "e2e",
  GEMINI_API_KEY: "e2e-key",
  GEMINI_BASE_URL: "http://127.0.0.1:4010",
  GITHUB_API_URL: "http://127.0.0.1:4010",
  DAILY_ANALYSIS_LIMIT: "5",
};
Object.assign(process.env, env);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    { command: "node tests/e2e/mock-server.mjs", port: 4010, reuseExistingServer: !process.env.CI },
    {
      command: `npx prisma migrate deploy && npx next build && npx next start -p ${PORT}`,
      port: PORT,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env,
    },
  ],
});
