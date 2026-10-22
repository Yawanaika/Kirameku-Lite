import type { Metadata } from "next";
import AccountManager from "@/components/admin/AccountManager";
import { getAdminSession } from "@/server/auth/guard";
import { authService } from "@/server/modules/auth/service";

export const metadata: Metadata = {
  title: "账号 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const session = await getAdminSession();
  const profile = session ? await authService.profile(session.id) : null;

  return <AccountManager initialProfile={profile} />;
}
