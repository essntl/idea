/**
 * Idempotent seed: creates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD on first boot
 * and a starter About page. Never overwrites existing data (password changes in settings are kept).
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  const users = await prisma.user.count();
  if (users === 0) {
    if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required to create the admin account.");
    if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
    await prisma.user.create({ data: { email, name: "Artem", passwordHash: await hashPassword(password) } });
    console.log(`[seed] created admin user ${email}`);
  } else {
    console.log("[seed] admin user exists, skipping");
  }

  if (!(await prisma.page.findUnique({ where: { key: "about" } }))) {
    const text = "Hi, I'm Artem. This page can be edited from the admin area.";
    const contentJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
    // Plain HTML matches what the renderer produces for a single paragraph; avoids bundling the renderer here.
    await prisma.page.create({ data: { key: "about", title: "About", contentJson, contentHtml: `<p>${text.replace("'", "&#x27;")}</p>` } });
    console.log("[seed] created About page");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[seed] failed:", err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
