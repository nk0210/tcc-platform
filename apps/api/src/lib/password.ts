import bcrypt from "bcryptjs";
import { getEnv } from "../config/env";

export async function hashPassword(plain: string): Promise<string> {
  const rounds = parseInt(getEnv().BCRYPT_ROUNDS, 10);
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}