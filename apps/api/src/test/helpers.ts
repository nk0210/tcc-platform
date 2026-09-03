/**
 * Shared test helpers.
 *
 * No separate test database exists yet in this repo, so tests run against
 * the real dev Postgres with throwaway users created/torn down per test —
 * same pattern as the manual QA passes run against this API during
 * development. `createTestUser` mirrors the exact fields
 * `POST /auth/register` creates (see routes/auth.ts) so tests exercise
 * realistic rows, not a stripped-down fixture shape.
 */
import { randomUUID } from "crypto";
import db from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { signAccessToken } from "../lib/jwt";
import { generateTccId } from "../lib/tccId";

export interface TestUser {
  id:          string;
  email:       string;
  handle:      string;
  accessToken: string;
}

export async function createTestUser(): Promise<TestUser> {
  const unique = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      email:           `copilot-test-${unique}@tcc.test`,
      handle:          `copilot_test_${unique}`,
      displayName:     `Copilot Test ${unique}`,
      tccId:           generateTccId("TRD"),
      passwordHash:    await hashPassword("TestPassword123!"),
      roles:           ["NORMAL_USER"],
      status:          "ACTIVE",
      tradingIdentity: { create: {} },
      socialLinks:     { create: {} },
    },
  });

  const accessToken = signAccessToken({
    userId: user.id,
    email:  user.email,
    handle: user.handle,
    roles:  user.roles,
  });

  return { id: user.id, email: user.email, handle: user.handle, accessToken };
}

/** Cascades to sessions, watchlist, journal entries, copilot conversations,
 *  etc. via the schema's onDelete: Cascade — one call cleans up everything
 *  a test user touched. */
export async function deleteTestUser(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } }).catch(() => {
    // Already deleted or never committed — fine for test cleanup.
  });
}
