import { z } from "zod";

const passwordSchema = z
  .string()
  .min(1, "请输入密码")
  .max(200, "密码过长")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "密码不能超过 72 字节（bcrypt 限制）",
  });

export const loginInput = z.object({
  username: z.string().trim().min(1, "请输入用户名").max(50),
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginInput>;

export const changePasswordInput = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema.refine(
      (value) => value.length >= 12,
      "新密码至少 12 位",
    ),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

export const profileInput = z.object({
  nickname: z.string().trim().max(50).optional(),
  avatar: z.string().trim().max(500).optional(),
  email: z
    .union([z.string().trim().email("邮箱格式不正确").max(100), z.literal("")])
    .optional(),
  bio: z.string().trim().max(500).optional(),
});

export type ProfileInput = z.infer<typeof profileInput>;
