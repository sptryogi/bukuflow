import type { ReactNode } from "react";
import Shell from "@/components/Shell";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GuruLayout({ children }: { children: ReactNode }) {
  await requireRole("guru");
  return (
    <Shell
      home="/guru"
      sub="Guru"
      items={[
        { href: "/guru", label: "Beranda", icon: "home" },
        { href: "/guru/riwayat", label: "Riwayat", icon: "clock" },
      ]}
    >
      {children}
    </Shell>
  );
}
