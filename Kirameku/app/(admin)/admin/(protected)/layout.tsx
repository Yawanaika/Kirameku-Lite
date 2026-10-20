import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminSession } from "@/server/auth/guard";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  return (
    <AdminShell
      admin={{
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        avatar: admin.avatar,
      }}
    >
      {children}
    </AdminShell>
  );
}
