import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getInstitution, getProgram } from "@/lib/q";
import { loadPanel } from "@/lib/panel";
import ProgramPanel from "@/components/ProgramPanel";

export const metadata: Metadata = { title: "Program" };

export default async function GuruProgram({ params, searchParams }: { params: Promise<{ pid: string }>; searchParams: Promise<{ tab?: string; minggu?: string }> }) {
  const me = await requireRole("guru");
  const { pid } = await params;
  const { tab, minggu } = await searchParams;
  const p = await getProgram(Number(pid));
  if (!p || p.institution_id !== me.institution_id) notFound();
  const inst = await getInstitution(p.institution_id);
  if (!inst) notFound();
  const w = Number(minggu);
  const panel = await loadPanel(p, "guru", inst, { tab: minggu ? "minggu" : tab, week: Number.isInteger(w) && w > 0 ? w - p.week_offset : undefined });
  return (
    <>
      <div className="breadcrumb"><Link href="/guru">← Beranda</Link></div>
      <h1>Program {p.months} bulan</h1>
      <ProgramPanel {...panel} />
    </>
  );
}
