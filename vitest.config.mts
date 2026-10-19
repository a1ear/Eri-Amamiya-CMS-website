import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
    server: { deps: { inline: ["convex-test", /@convex-dev\//] } },
    env: {
      SITE_URL: "http://localhost:3000",
      CONVEX_SITE_URL: "http://127.0.0.1:3211",
      BETTER_AUTH_SECRET: "test-secret-not-used-outside-vitest-0123456789",
    },
  },
});
