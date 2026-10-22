"use client";

import { useState } from "react";
import { KeyRound, Save, UserRound } from "lucide-react";
import AdminError from "./AdminError";
import ImageUploader from "./ImageUploader";
import { adminRequest, describeAdminError } from "./admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PublicAdmin } from "@/server/modules/auth/service";

interface AccountManagerProps {
  initialProfile: PublicAdmin | null;
}

interface ProfileForm {
  nickname: string;
  avatar: string;
  email: string;
  bio: string;
}

function profileForm(profile: PublicAdmin | null): ProfileForm {
  return {
    nickname: profile?.nickname ?? "",
    avatar: profile?.avatar ?? "",
    email: profile?.email ?? "",
    bio: profile?.bio ?? "",
  };
}

export default function AccountManager({ initialProfile }: AccountManagerProps) {
  const [profile, setProfile] = useState<PublicAdmin | null>(initialProfile);
  const [form, setForm] = useState<ProfileForm>(profileForm(initialProfile));
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  function updateProfile<K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const { user } = await adminRequest<{ user: PublicAdmin }>(
        "/api/auth/me",
        {
          method: "PUT",
          body: JSON.stringify({
            nickname: form.nickname,
            avatar: form.avatar,
            email: form.email,
            bio: form.bio,
          }),
        },
      );
      setProfile(user);
      setForm(profileForm(user));
      setProfileNotice("资料已保存");
    } catch (reason) {
      setProfileError(describeAdminError(reason));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("两次输入的新密码不一致");
      return;
    }

    setSavingPassword(true);
    try {
      await adminRequest<{ ok: true }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordNotice("密码已更新，下次登录请使用新密码");
    } catch (reason) {
      setPasswordError(describeAdminError(reason));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-600 uppercase">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          账号
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          更新站点展示的昵称、头像和简介，或修改登录密码。
        </p>
      </header>

      {profile ? (
        <p className="text-xs text-slate-500">
          登录账号：<span className="text-slate-300">{profile.username}</span>
          {" · "}
          角色：
          <span className="text-slate-300">
            {profile.isAdmin ? "管理员" : "普通用户"}
          </span>
        </p>
      ) : null}

      <form
        onSubmit={saveProfile}
        className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/40 p-6"
      >
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <UserRound className="size-4 text-sky-300" aria-hidden />
          个人资料
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nickname">昵称</Label>
            <Input
              id="nickname"
              value={form.nickname}
              maxLength={50}
              onChange={(event) => updateProfile("nickname", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              maxLength={100}
              onChange={(event) => updateProfile("email", event.target.value)}
            />
          </div>
        </div>

        <ImageUploader
          value={form.avatar}
          onChange={(url) => updateProfile("avatar", url)}
          label="头像"
          hint="支持 JPG/PNG/WebP/GIF，最大 10MB；也可以直接填写站内路径或完整 URL。"
        />

        <div className="space-y-2">
          <Label htmlFor="bio">简介</Label>
          <Textarea
            id="bio"
            rows={4}
            maxLength={500}
            value={form.bio}
            onChange={(event) => updateProfile("bio", event.target.value)}
          />
        </div>

        {profileError ? <AdminError message={profileError} /> : null}
        {profileNotice ? (
          <p role="status" className="text-xs text-emerald-300">
            {profileNotice}
          </p>
        ) : null}

        <Button type="submit" disabled={savingProfile}>
          <Save className="size-4" aria-hidden />
          {savingProfile ? "保存中…" : "保存资料"}
        </Button>
      </form>

      <form
        onSubmit={savePassword}
        className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/40 p-6"
      >
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <KeyRound className="size-4 text-amber-300" aria-hidden />
          修改密码
        </h2>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">当前密码</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) =>
                setPasswords((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(event) =>
                setPasswords((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={passwords.confirmPassword}
              onChange={(event) =>
                setPasswords((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <p className="text-[11px] leading-5 text-slate-600">
          新密码至少 12 位；修改后当前会话保持登录，其他设备需要重新登录。
        </p>

        {passwordError ? <AdminError message={passwordError} /> : null}
        {passwordNotice ? (
          <p role="status" className="text-xs text-emerald-300">
            {passwordNotice}
          </p>
        ) : null}

        <Button type="submit" variant="outline" disabled={savingPassword}>
          <KeyRound className="size-4" aria-hidden />
          {savingPassword ? "更新中…" : "更新密码"}
        </Button>
      </form>
    </div>
  );
}
