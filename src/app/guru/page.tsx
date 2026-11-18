import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getInstitution, institutionPrograms } from "@/lib/q";
import { programState } from "@/lib/view";
import { PHASE_LABEL, fmtDate } from "@/lib/schedule";
import ProfileCard from "@/components/ProfileCard";
import ProgressBar from "@/components/ProgressBar";

export default async function GuruHome() {
  const me = await requireRole("guru");
  const inst = me.institution_id ? await getInstitution(me.institution_id) : null;
  const programs = inst ? await institutionPrograms(inst.id) : [];
  return (
    <>
      <h1>Beranda</h1>
      <p className="sub">Halo, {me.name}.</p>
      <ProfileCard user={me} institution={inst?.name ?? null} />
      <h2>Program {inst ? `di ${inst.name}` : ""}</h2>
      {!inst && <div className="notice warn">Akun Anda belum terhubung ke institusi. Hubungi admin.</div>}
      {inst && programs.length === 0 && <div className="card muted">Belum ada program. Admin akan membuat program untuk institusi Anda.</div>}
      <div className="grid2">
        {programs.map((p) => {
          const st = programState(p);
          return (
            <Link key={p.id} href={`/guru/program/${p.id}`} className="pcard" style={{ color: "inherit" }}>
              <div className="row between">
                <h3>Program {p.months} bulan</h3>
                <span className={`pill ${st.phase === "berjalan" ? "info" : st.phase === "selesai" ? "ok" : "warn"}`}>{PHASE_LABEL[st.phase]}</span>
              </div>
              <div className="muted small" style={{ marginBottom: 8 }}>Mulai {fmtDate(p.start_date)} · {p.students} murid</div>
              {p.status === "siap" ? <ProgressBar pct={st.pct} label={st.label} /> : <div className="notice warn" style={{ margin: 0 }}>Perlu unggah data murid. Buka program lalu pilih tab “Data murid”.</div>}
            </Link>
          );
        })}
      </div>
    </>
  );
}
