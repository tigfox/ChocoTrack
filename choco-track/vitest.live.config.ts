import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", globals: true, include: ["app/**/*.smoke.ts"], testTimeout: 180_000 },
});
