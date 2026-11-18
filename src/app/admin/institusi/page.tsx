import type { Metadata } from "next";
import Link from "next/link";
import { allProgramsBrief, listInstitutionsSummary } from "@/lib/q";
import { programState } from "@/lib/view";
import { NewInstitutionButton } from "@/components/InstitutionEditor";

export const metadata: Metadata = { title: "Institusi" };

export default async function InstitusiPage() {
  const [insts, programs] = await Promise.all([listInstitutionsSummary(), allProgramsBrief()]);
  const running = new Map<number, number>();
  for (const p of programs) {
    if (programState({ status: p.status, start_date: p.start_date, weeks: p.weeks, months: p.weeks / 4 }).phase === "berjalan") {
      running.set(p.institution_id, (running.get(p.institution_id) ?? 0) + 1);
    }
  }
  return (
    <>
      <div className="row between">
        <div><h1>Institusi</h1><p className="sub" style={{ marginBottom: 12 }}>{insts.length} sekolah / instansi terdaftar. Klik untuk mengelola program.</p></div>
        <NewInstitutionButton />
      </div>
      <div className="tablewrap">
        <table className="rtable">
          <thead><tr><th>Nama</th><th>Status</th><th className="num">Guru aktif</th><th className="num">Program</th><th className="num">Berjalan</th></tr></thead>
          <tbody>
            {insts.map((i) => (
              <tr key={i.id}>
                <td data-label="Nama"><Link href={`/admin/institusi/${i.id}`}><strong>{i.name}</strong></Link></td>
                <td data-label="Status">
                  {i.guru_aktif > 0 ? <span className="pill ok">Terdaftar</span> : i.guru_total > 0 ? <span className="pill warn">Menunggu persetujuan</span> : <span className="pill">Belum ada guru</span>}
                </td>
                <td className="num" data-label="Guru aktif">{i.guru_aktif}/{i.guru_total}</td>
                <td className="num" data-label="Program">{i.program_total}</td>
                <td className="num" data-label="Berjalan">{running.get(i.id) ?? 0}</td>
              </tr>
            ))}
            {insts.length === 0 && <tr><td colSpan={5} className="muted">Belum ada institusi.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
