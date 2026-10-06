import { configDefaults, defineConfig } from "vitest/config";

// e2e/ holds Playwright specs (`npm run test:e2e`); Vitest must not collect them.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
});
