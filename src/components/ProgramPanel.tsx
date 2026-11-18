"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import ProgressBar from "@/components/ProgressBar";
import RosterUpload from "@/components/RosterUpload";
import { LEVELS, type Level } from "@/lib/engine";
import { PHASE_LABEL, addDays, fmtDate, type Phase } from "@/lib/schedule";

type Tab = "saat_ini" | "tabel" | "minggu" | "unduh" | "murid";
export type PanelProps = {
  role: "admin" | "guru";
  program: { id: number; months: number; weeks: number; start_date: string; week_offset: number; status: string; alloc_error: string | null };
  institution: { id: number; name: string };
  released: number;
  phase: Phase;
  pct: number;
  label: string;
  roster: { id: number; nis: string; name: string; level: Level }[];
  cells: { student_id: number; week: number; book_id: number }[];
  titles: Record<number, string>;
  copyFrom: { id: number; label: string } | null;
  initialTab?: Tab;
  initialWeek?: number;
};

export default function ProgramPanel(p: PanelProps) {
  const { program, released, roster } = p;
  const admin = p.role === "admin";
  const visible = admin ? program.weeks : released;
  const needsData = program.status === "menunggu_data";
  const [tab, setTab] = useState<Tab>(p.initialTab ?? (needsData ? "murid" : "saat_ini"));
  const [week, setWeek] = useState(Math.min(Math.max(p.initialWeek ?? released, 1), Math.max(visible, 1)));
  const [level, setLevel] = useState<Level | "Semua">("Semua");
  const [q, setQ] = useState("");

  const cellOf = useMemo(() => new Map(p.cells.map((c) => [`${c.student_id}:${c.week}`, c.book_id])), [p.cells]);
  const title = (sid: number, w: number) => {
    const b = cellOf.get(`${sid}:${w}`);
    return b ? (p.titles[b] ?? "-") : "";
  };
  const g = (w: number) => program.week_offset + w; // nomor minggu global
  const releaseLabel = (w: number) => `Senin ${fmtDate(addDays(program.start_date, (w - 1) * 7))}, 02.00 WIB`;
  const weeks = Array.from({ length: visible }, (_, i) => i + 1);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return roster.filter((s) => (level === "Semua" || s.level === level) && (!t || s.name.toLowerCase().includes(t) || s.nis.toLowerCase().includes(t)));
  }, [roster, level, q]);

  const counts = LEVELS.map((l) => `${l} ${roster.filter((s) => s.level === l).length}`).join(" · ");
  const nowWeek = released > 0 ? released : admin ? 1 : 0;

  const filters = (
    <div className="row" style={{ marginBottom: 10 }}>
      <input className="input grow" style={{ minWidth: 180 }} placeholder="Cari nama / NIS…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {(["Semua", ...LEVELS] as const).map((l) => (
          <button key={l} className={`chip ${level === l ? "on" : ""}`} onClick={() => setLevel(l)}>{l}</button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>Program {program.months} bulan</h2>
            <div className="muted small">
              {p.institution.name} · mulai {fmtDate(program.start_date)}
              {program.week_offset > 0 && ` · lanjutan (minggu ke-${g(1)} dst.)`}
            </div>
          </div>
          <span className={`pill ${p.phase === "berjalan" ? "info" : p.phase === "selesai" ? "ok" : "warn"}`}>{PHASE_LABEL[p.phase]}</span>
        </div>
        {needsData ? (
          <div className="notice warn">Program belum aktif. Unggah data murid (template Excel) agar alokasi dapat dibuat.</div>
        ) : (
          <ProgressBar pct={p.pct} label={p.label} />
        )}
        {program.alloc_error && <div className="notice err">Alokasi terakhir gagal: {program.alloc_error}</div>}
        {!needsData && <p className="muted small" style={{ margin: "8px 0 0" }}>{roster.length} murid · {counts}</p>}
      </div>

      <div className="tabs" role="tablist">
        {([["saat_ini", "Saat ini"], ["tabel", "Tabel alokasi"], ["minggu", "Per minggu"], ["unduh", "Unduh"], ["murid", "Data murid"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "saat_ini" && (
        <>
          {nowWeek === 0 ? (
            <div className="notice warn">Program belum dimulai. Minggu ke-{g(1)} dirilis {releaseLabel(1)}.</div>
          ) : (
            <p className="muted">
              {released > 0 ? `Minggu ke-${g(nowWeek)}` : `Rencana minggu ke-${g(1)} (belum dirilis)`} · murid, level, dan buku yang sedang dibaca.
            </p>
          )}
          {filters}
          {nowWeek > 0 && (
            <div className="tablewrap">
              <table className="rtable">
                <thead><tr><th>NIS</th><th>Nama Murid</th><th>Level</th><th>Sedang membaca</th></tr></thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td data-label="NIS">{s.nis}</td>
                      <td data-label="Nama" style={{ fontWeight: 600 }}>{s.name}</td>
                      <td data-label="Level"><Badge level={s.level} /></td>
                      <td data-label="Buku">{title(s.id, nowWeek) || "-"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={4} className="muted">Tidak ada murid.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "tabel" && (
        <>
          {visible === 0 ? <div className="notice warn">Belum ada minggu yang dirilis.</div> : (
            <>
              {filters}
              <div className="matrix-wrap only-d">
                <table className="matrix">
                  <thead>
                    <tr>
                      <th className="sa" style={{ width: 90, minWidth: 90 }}>NIS</th>
                      <th className="sb" style={{ left: 90 }}>Nama</th>
                      <th>Level</th>
                      {weeks.map((w) => <th key={w}>Minggu ke-{g(w)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td className="sa" style={{ width: 90, minWidth: 90 }}>{s.nis}</td>
                        <td className="sb" style={{ left: 90 }}><strong>{s.name}</strong></td>
                        <td><Badge level={s.level} /></td>
                        {weeks.map((w) => (
                          <td key={w}><span className={`cell static ${w > released ? "future" : ""}`} title={title(s.id, w)}>{title(s.id, w) || "-"}</span></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="only-m">
                {rows.map((s) => (
                  <details key={s.id} className="mcard">
                    <summary><strong className="grow">{s.name}</strong><Badge level={s.level} /><span className="muted small">{s.nis}</span></summary>
                    <ol>
                      {weeks.map((w) => (
                        <li key={w}><span className="w">Minggu {g(w)}</span><span className={`cell static ${w > released ? "future" : ""}`} style={{ width: "auto", flex: 1 }}>{title(s.id, w) || "-"}</span></li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
              {admin && <p className="muted small">Minggu yang belum dirilis ke guru ditampilkan miring.</p>}
            </>
          )}
        </>
      )}

      {tab === "minggu" && (
        <>
          {visible === 0 ? <div className="notice warn">Belum ada minggu yang dirilis.</div> : (
            <>
              <div className="chips" style={{ marginBottom: 10 }}>
                {weeks.map((w) => <button key={w} className={`chip ${w === week ? "on" : ""}`} onClick={() => setWeek(w)}>Minggu {g(w)}</button>)}
              </div>
              {filters}
              <div className="tablewrap">
                <table className="rtable">
                  <thead><tr><th>NIS</th><th>Nama Murid</th><th>Level</th><th>Buku Minggu ke-{g(week)}</th></tr></thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td data-label="NIS">{s.nis}</td><td data-label="Nama"><strong>{s.name}</strong></td>
                        <td data-label="Level"><Badge level={s.level} /></td><td data-label="Buku">{title(s.id, week) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab === "unduh" && (
        <div className="card">
          <h2>File alokasi</h2>
          <p className="muted small">
            File baru tersedia setiap Senin pukul 02.00 WIB. Setiap file berisi NIS, Nama Murid, Level, dan kolom Minggu ke-… dari awal program sampai minggu tersebut.
          </p>
          {released < program.weeks && !needsData && (
            <div className="notice ok">Berikutnya: Minggu ke-{g(released + 1)} akan dirilis {releaseLabel(released + 1)}.</div>
          )}
          {needsData ? <p className="muted">Belum ada file. Unggah data murid terlebih dahulu.</p> : visible === 0 ? <p className="muted">File pertama tersedia {releaseLabel(1)}.</p> : (
            <div>
              {[...weeks].reverse().map((w) => (
                <div className="wk" key={w}>
                  <div>
                    <strong>Minggu ke-{g(w)}</strong>{w === released && <> <span className="pill info">terbaru</span></>}{w > released && <> <span className="pill warn">belum dirilis</span></>}
                    <div className="muted small">Rilis {releaseLabel(w)}</div>
                  </div>
                  <div className="row">
                    <a className="btn sm" href={`/download/program/${program.id}?format=xlsx&upto=${w}`}>Excel</a>
                    <a className="btn sm" href={`/download/program/${program.id}?format=pdf&upto=${w}`}>PDF</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "murid" && (
        <RosterUpload programId={program.id} institutionId={p.institution.id} hasRoster={roster.length > 0} running={program.status === "siap" && released > 0} copyFrom={roster.length === 0 ? p.copyFrom : null} />
      )}
    </>
  );
}
