import { hash, verify } from "@node-rs/argon2";

export function hashPassword(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export const passwordSchemaMessage = "Password must be at least 10 characters";
export const MIN_PASSWORD_LENGTH = 10;
