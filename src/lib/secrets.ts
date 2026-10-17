import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption for secrets stored in the database (e.g. the AI API key), keyed from NEXTAUTH_SECRET.
 * Changing NEXTAUTH_SECRET makes stored secrets unreadable; they then have to be entered again.
 */
function key() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHash("sha256").update(`idea:secrets:v1:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Null when the value is malformed or was encrypted with a different NEXTAUTH_SECRET. */
export function decryptSecret(stored: string): string | null {
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Setting keys with this prefix hold encrypted secrets: never sent to the browser, never exported in backups. */
export const SECRET_PREFIX = "secret:";
