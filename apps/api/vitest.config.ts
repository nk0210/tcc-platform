import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    // Tests hit the real dev Postgres DB with throwaway users (no test-DB
    // infra exists yet in this repo) — run serially so tests that create/
    // clean up their own users don't race each other.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
