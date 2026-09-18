import { defineConfig } from "vitest/config";
import path from "node:path";

process.env.TZ = "UTC";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/canonical/**/*.test.ts"],
    pool: "forks",
    sequence: { concurrent: false },
  },
});
