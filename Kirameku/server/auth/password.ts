import bcrypt from "bcryptjs";

const ROUNDS = 12;

export const MAX_PASSWORD_BYTES = 72;

export function passwordByteLength(password: string): number {
  return Buffer.byteLength(password, "utf8");
}

export async function hashPassword(password: string): Promise<string> {
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
    throw new Error(
      `Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes (bcrypt limit)`,
    );
  }
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashed: string,
): Promise<boolean> {
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) return false;
  try {
    return await bcrypt.compare(password, hashed);
  } catch {
    return false;
  }
}
