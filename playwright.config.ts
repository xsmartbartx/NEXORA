import { defineConfig } from "@playwright/test";

// Read-only smoke tests against a deployed environment. No browser is needed:
// they use Playwright's request client. `E2E_DOMAIN` switches the environment.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  reporter: [["list"]],
});
