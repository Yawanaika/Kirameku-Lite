import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { signAdminToken } from "@/server/auth/session";
import { errors } from "@/server/http/errors";
import type { ProfileInput } from "./contracts";

export interface PublicAdmin {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  email: string | null;
  bio: string | null;
  isAdmin: boolean;
}

function toPublicAdmin(row: typeof user.$inferSelect): PublicAdmin {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    email: row.email,
    bio: row.bio,
    isAdmin: row.isAdmin === true,
  };
}

// Used to keep the unknown-user path roughly as expensive as the wrong-password
// path. This is not a real credential.
const DUMMY_BCRYPT_HASH =
  "$2b$12$TGOhu5EQLSiHX1ygagF8xO3C1b7XvVWVOXsJOJTd3texDW5b7kP4.";

export const authService = {
  async login(username: string, password: string) {
    const [row] = await getDb()
      .select()
      .from(user)
      .where(eq(user.username, username))
      .limit(1);

    // Use the same generic error for unknown users, wrong passwords, and
    // non-admin accounts so the endpoint cannot be used to enumerate admins.
    const matches = await verifyPassword(
      password,
      row?.hashedPassword ?? DUMMY_BCRYPT_HASH,
    );
    if (!row || !matches || !row.isAdmin) {
      throw errors.unauthorized("用户名或密码错误");
    }

    return {
      token: await signAdminToken(row.id),
      user: toPublicAdmin(row),
    };
  },

  async profile(userId: number) {
    const [row] = await getDb()
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) throw errors.notFound("管理员不存在");
    return toPublicAdmin(row);
  },

  async updateProfile(userId: number, input: ProfileInput) {
    await getDb()
      .update(user)
      .set({
        ...(input.nickname === undefined ? {} : { nickname: input.nickname }),
        ...(input.avatar === undefined ? {} : { avatar: input.avatar }),
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.bio === undefined ? {} : { bio: input.bio }),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    const [row] = await getDb()
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) throw errors.notFound("管理员不存在");
    return toPublicAdmin(row);
  },

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const [row] = await getDb()
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!row || !(await verifyPassword(currentPassword, row.hashedPassword))) {
      throw errors.badRequest("当前密码不正确");
    }

    const hashedPassword = await hashPassword(newPassword);
    await getDb()
      .update(user)
      .set({ hashedPassword, updatedAt: new Date() })
      .where(eq(user.id, userId));

    return { ok: true as const };
  },
};
