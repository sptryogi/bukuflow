import type { ReactNode } from "react";
import Shell from "@/components/Shell";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("admin");
  return (
    <Shell
      home="/admin"
      sub="Admin"
      items={[
        { href: "/admin", label: "Ringkasan", icon: "home" },
        { href: "/admin/institusi", label: "Institusi", icon: "building" },
        { href: "/admin/guru", label: "Guru", icon: "users" },
        { href: "/admin/buku", label: "Buku", icon: "book" },
      ]}
    >
      {children}
    </Shell>
  );
}
