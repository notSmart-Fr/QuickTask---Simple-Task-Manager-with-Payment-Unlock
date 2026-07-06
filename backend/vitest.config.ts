import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // config.ts reads process.env at import time — provide defaults for tests
    env: {
      DATABASE_URL: "postgres://localhost:5432/test",
      JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars!!",
      STRIPE_SECRET_KEY: "sk_test_mock",
      STRIPE_WEBHOOK_SECRET: "whsec_mock",
      PORT: "4001",
      FRONTEND_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
  },
});
