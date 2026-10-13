import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    currentPassword: z.string().min(1).max(500),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(500),
    email: z.string().trim().toLowerCase().email().max(200).optional(),
  })
  .refine((v) => v.currentPassword !== v.newPassword, { message: "New password must differ", path: ["newPassword"] });

/** Changes the admin password (and optionally email). Bumps sessionVersion, which signs out other sessions. */
export const POST = adminRoute(async (req, { admin }) => {
  const input = schema.parse(await readJson(req));
  const limit = await rateLimit(`password:${admin.id}`, 5, 15 * 60);
  if (!limit.ok) throw new HttpError(429, "Too many attempts, try again later");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) throw new HttpError(400, "Current password is incorrect");
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(input.newPassword), sessionVersion: { increment: 1 }, ...(input.email ? { email: input.email } : {}) },
  });
  return NextResponse.json({ ok: true, signedOut: true });
});
