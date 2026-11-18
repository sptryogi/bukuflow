import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstitution, getProgram } from "@/lib/q";
import { loadPanel } from "@/lib/panel";
import ProgramPanel from "@/components/ProgramPanel";
import { ProgramAdminActions } from "@/components/ProgramForm";

export const metadata: Metadata = { title: "Program" };

export default async function AdminProgram({ params, searchParams }: { params: Promise<{ id: string; pid: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id, pid } = await params;
  const { tab } = await searchParams;
  const p = await getProgram(Number(pid));
  const inst = await getInstitution(Number(id));
  if (!p || !inst || p.institution_id !== inst.id) notFound();
  const panel = await loadPanel(p, "admin", inst, { tab });
  return (
    <>
      <div className="breadcrumb"><Link href={`/admin/institusi/${inst.id}`}>← {inst.name}</Link></div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Detail Program</h1>
        <div className="row"><ProgramAdminActions institutionId={inst.id} program={{ id: p.id, months: p.months, copies: p.copies, status: p.status }} backHref={`/admin/institusi/${inst.id}`} /></div>
      </div>
      <ProgramPanel {...panel} />
    </>
  );
}
