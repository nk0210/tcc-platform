import { z } from "zod";

const schema = z.object({
  NODE_ENV:               z.enum(["development", "production", "test"]).default("development"),
  PORT:                   z.string().default("4000"),
  DATABASE_URL:           z.string({ required_error: "DATABASE_URL is required" }),
  JWT_ACCESS_SECRET:      z.string({ required_error: "JWT_ACCESS_SECRET is required" }),
  JWT_REFRESH_SECRET:     z.string({ required_error: "JWT_REFRESH_SECRET is required" }),
  JWT_ACCESS_EXPIRES_IN:  z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN:            z.string().default("http://localhost:3000"),
  BCRYPT_ROUNDS:          z.string().default("12"),
});

export type Env = z.infer<typeof schema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌  Invalid environment variables:");
    for (const e of parsed.error.errors) {
      console.error(`   ${e.path.join(".")}: ${e.message}`);
    }
    process.exit(1);
  }
  _env = parsed.data;
  return _env;
}

export const isDev = (): boolean => getEnv().NODE_ENV === "development";