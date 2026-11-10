import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["app/domain/**/*.ts"],
      exclude: ["app/domain/**/*.test.ts", "app/domain/fixtures.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
