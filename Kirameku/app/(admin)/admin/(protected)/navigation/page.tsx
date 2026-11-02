import type { Metadata } from "next";
import NavDropdownManager from "@/components/admin/NavDropdownManager";

export const metadata: Metadata = {
  title: "导航菜单 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminNavigationPage() {
  return <NavDropdownManager />;
}
