import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/** Synchronous variant, used only to build seed/fixture data at module load time. */
export function hashPasswordSync(plainPassword: string): string {
  return bcrypt.hashSync(plainPassword, SALT_ROUNDS);
}
