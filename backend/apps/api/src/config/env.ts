import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  AI_SERVICE_URL: z.string().url(),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(6000),
  AI_SERVICE_RETRY_COUNT: z.coerce.number().int().min(0).max(3).default(1),
  INSIGHTS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  DEMO_USER_EMAIL: z.string().email().default("demo@finsight.ai"),
  DEMO_USER_PASSWORD: z.string().min(8).default("DemoPass123!")
});

export const env = envSchema.parse(process.env);

