/**
 * Startup check run by the container entrypoint before migrations.
 * Exits with a clear message when required configuration is missing or still a placeholder.
 */
const problems: string[] = [];
const value = (k: string) => process.env[k]?.trim() ?? "";
const placeholder = (v: string) => /change[_-]?me/i.test(v);

const secret = value("NEXTAUTH_SECRET");
if (!secret) problems.push("NEXTAUTH_SECRET is not set. Generate one with: openssl rand -base64 32");
else if (placeholder(secret)) problems.push("NEXTAUTH_SECRET still has its placeholder value. Generate one with: openssl rand -base64 32");
else if (secret.length < 16) problems.push("NEXTAUTH_SECRET must be at least 16 characters.");

const email = value("ADMIN_EMAIL");
const password = value("ADMIN_PASSWORD");
if (!email || placeholder(email)) problems.push("ADMIN_EMAIL is not set (the admin account is created from it on first start).");
if (!password || placeholder(password)) problems.push("ADMIN_PASSWORD is not set or still a placeholder.");
else if (password.length < 8) problems.push("ADMIN_PASSWORD must be at least 8 characters.");

if (!value("DATABASE_URL")) problems.push("DATABASE_URL is not set.");

const site = value("SITE_URL") || value("NEXTAUTH_URL");
if (site) {
  try {
    new URL(site);
  } catch {
    problems.push(`SITE_URL is not a valid URL: ${site}`);
  }
}

const provider = value("CAPTCHA_PROVIDER") || "turnstile";
if (provider !== "turnstile" && provider !== "recaptcha") problems.push(`CAPTCHA_PROVIDER must be "turnstile" or "recaptcha" (got "${provider}").`);

if (problems.length) {
  console.error("\n✖ Refusing to start — configuration problems:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nEdit your .env file (or the app's environment variables in ZimaOS) and restart.\n");
  process.exit(1);
}

const keys = provider === "turnstile" ? ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] : ["RECAPTCHA_SITE_KEY", "RECAPTCHA_SECRET_KEY"];
if (keys.some((k) => !value(k))) console.warn(`⚠ ${keys.join(" / ")} not set: visitors won't be able to comment until captcha keys are configured.`);
if (value("TURNSTILE_SITE_KEY") === "1x00000000000000000000AA") console.warn("⚠ Using Cloudflare's TEST Turnstile keys (every visitor passes). Replace them for production.");
console.log("✓ Configuration OK");
