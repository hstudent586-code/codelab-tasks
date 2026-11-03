import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts"],
      reporter: ["text", "html", "json-summary"],
      // пайплайн зупиняється, якщо покриття нижче порогу
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
