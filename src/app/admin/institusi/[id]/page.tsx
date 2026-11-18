import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstitution, institutionGurus, institutionPrograms, listInstitutionOptions } from "@/lib/q";
import { programState } from "@/lib/view";
import { PHASE_LABEL, fmtDate } from "@/lib/schedule";
import GuruTable from "@/components/GuruTable";
import ProgressBar from "@/components/ProgressBar";
import { InstitutionEditor } from "@/components/InstitutionEditor";
import { CreateProgramButton } from "@/components/ProgramForm";

export const metadata: Metadata = { title: "Institusi" };

export default async function InstitusiDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const inst = Number.isInteger(id) ? await getInstitution(id) : null;
  if (!inst) notFound();
  const [gurus, programs, options] = await Promise.all([institutionGurus(id), institutionPrograms(id), listInstitutionOptions()]);
  const prev = programs.filter((p) => p.status === "siap").map((p) => ({ id: p.id, label: `Program ${p.months} bulan · mulai ${fmtDate(p.start_date)}` }));

  return (
    <>
      <div className="breadcrumb"><Link href="/admin/institusi">← Institusi</Link></div>
      <div className="row between">
        <div><h1>{inst.name}</h1><InstitutionEditor id={inst.id} name={inst.name} /></div>
        <div className="row">
          <a className="btn" href={`/download/template?institution=${inst.id}`}>Unduh template murid</a>
          <CreateProgramButton institutionId={inst.id} prev={prev} />
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Program</h2>
      {programs.length === 0 && <div className="card muted">Belum ada program. Klik “Buat program”.</div>}
      <div className="grid2">
        {programs.map((p) => {
          const st = programState(p);
          return (
            <Link key={p.id} href={`/admin/institusi/${inst.id}/program/${p.id}`} className="pcard" style={{ color: "inherit" }}>
              <div className="row between">
                <h3>Program {p.months} bulan</h3>
                <span className={`pill ${st.phase === "berjalan" ? "info" : st.phase === "selesai" ? "ok" : "warn"}`}>{PHASE_LABEL[st.phase]}</span>
              </div>
              <div className="muted small" style={{ marginBottom: 8 }}>Mulai {fmtDate(p.start_date)} · {p.students} murid{p.mode === "lanjutan" ? " · lanjutan" : ""}</div>
              {p.status === "siap" ? <ProgressBar pct={st.pct} label={st.label} /> : <div className="muted small">Menunggu data murid (template belum diunggah)</div>}
            </Link>
          );
        })}
      </div>

      <h2 style={{ marginTop: 22 }}>Guru terdaftar</h2>
      <GuruTable gurus={gurus} institutions={options} showInstitution={false} />
    </>
  );
}
