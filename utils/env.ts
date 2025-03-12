import "../config/dotenvSetup"; // ensure .env variables are loaded
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE: z.string(),
  PUBLIC_URL: z.string().url(),
  SERVER_URL: z.string().url(),
  SESSION_SECRET: z.string(),
  SENTRY_DSN: z.string().optional().transform(val => (val === "sentry-dsn" ? undefined : val)),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_GUILD_ID: z.string(),
  DISCORD_EXEC_ROLE_ID: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error(parsedEnv.error.format());
  throw new Error("Invalid environment variables");
}

export const env = {
  ...parsedEnv.data,
};

export function getBrowserEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV || "development",
    PUBLIC_URL: process.env.PUBLIC_URL || "http://localhost:3000",
    // add any other client-safe env with defaults
  };
}
