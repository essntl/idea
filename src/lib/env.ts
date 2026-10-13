import { z } from "zod";

/** Treat empty strings (e.g. `NEXTAUTH_URL=` in .env) as unset. */
const opt = <T extends z.ZodTypeAny>(t: T) => z.preprocess((v) => (v === "" ? undefined : v), t);

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SITE_URL: opt(z.string().url().optional()),
  NEXTAUTH_URL: opt(z.string().url().optional()),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  CAPTCHA_PROVIDER: opt(z.enum(["turnstile", "recaptcha"]).default("turnstile")),
  TURNSTILE_SITE_KEY: z.string().optional().default(""),
  TURNSTILE_SECRET_KEY: z.string().optional().default(""),
  RECAPTCHA_SITE_KEY: z.string().optional().default(""),
  RECAPTCHA_SECRET_KEY: z.string().optional().default(""),
  UPLOAD_DIR: opt(z.string().default("./uploads")),
  MAX_UPLOAD_MB: opt(z.coerce.number().positive().max(500).default(15)),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated server environment. Throws a readable error listing every problem. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Public base URL without trailing slash. */
export function siteUrl(): string {
  const url = process.env.SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
