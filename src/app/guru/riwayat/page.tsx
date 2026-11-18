import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { institutionPrograms } from "@/lib/q";
import { programState } from "@/lib/view";
import { PHASE_LABEL, fmtDate } from "@/lib/schedule";

export const metadata: Metadata = { title: "Riwayat" };

export default async function Riwayat() {
  const me = await requireRole("guru");
  const programs = me.institution_id ? await institutionPrograms(me.institution_id) : [];
  return (
    <>
      <h1>Riwayat Alokasi</h1>
      <p className="sub">Semua program dan alokasi buku per minggu yang sudah dirilis.</p>
      {programs.length === 0 && <div className="card muted">Belum ada program.</div>}
      {programs.map((p) => {
        const st = programState(p);
        return (
          <div className="card" key={p.id}>
            <div className="row between">
              <div>
                <strong>Program {p.months} bulan</strong>
                <div className="muted small">Mulai {fmtDate(p.start_date)} · {p.students} murid</div>
              </div>
              <span className="pill">{PHASE_LABEL[st.phase]}</span>
            </div>
            {st.released === 0 ? (
              <p className="muted small" style={{ marginBottom: 0 }}>Belum ada minggu yang dirilis.</p>
            ) : (
              <div className="chips" style={{ marginTop: 10 }}>
                {Array.from({ length: st.released }, (_, i) => i + 1).map((w) => (
                  <Link key={w} className="chip" href={`/guru/program/${p.id}?minggu=${p.week_offset + w}`}>Minggu {p.week_offset + w}</Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
