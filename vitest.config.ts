import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      // `@` must resolve to the code that actually ships. It previously pointed
      // at the root `src/` tree, an orphaned pre-monorepo fork, so the suite
      // passed against logic no deployed app runs. See docs/adr/0003.
      "@": resolve(__dirname, "apps/app/src"),
      "@agencyos/config": resolve(__dirname, "packages/config/src/index.ts"),
      "@agencyos/database": resolve(__dirname, "packages/database/src/index.ts"),
      "@agencyos/domain": resolve(__dirname, "packages/domain/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
      "tests/security/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["apps/app/src/lib/**/*.ts", "packages/*/src/**/*.ts"],
      exclude: ["**/*.d.ts"],
    },
    setupFiles: ["tests/setup.ts"],
  },
})
