import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside React Server Components; it's a no-op for unit tests.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"], testTimeout: 20_000 },
});
