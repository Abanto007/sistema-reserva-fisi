import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/tests/**/*.test.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    env: { CORREO_MODO: "simulado" },
  },
});
