import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, {
    message: "JWT_SECRET must be at least 32 characters",
  }),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  PORT: z.coerce.number().int().positive(),
  FRONTEND_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const config = ConfigSchema.parse(process.env);

export default config;
