"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: number; student_id: number; nis: string; name: string; level: string; title: string | null; status: string; hold: boolean; total: number | null; edited: boolean; has_scan: boolean; note: string | null };
type Key = { no: number; question: string; expected: string };
type Butir = { no: number; skor: number; komentar: string; tahan: boolean };
type Detail = {
  id: number; name: string; nis: string; level: string; title: string | null; weekGlobal: number; status: string; hold: boolean; note: string | null; is_test: boolean; has_scan: boolean; edited: boolean;
  keys: Key[]; ocr: string[]; answers: string[]; grade: { total: number; butir: Butir[] } | null; evaluasi: { label: string; text: string }[];
};

const LEVELS = ["Pemula", "Madya", "Mahir"];
const RED = "#d00000";

function StatusPill({ it }: { it: Item }) {
  if (it.hold) return <span className="pill warn">Nama berbeda · ditahan</span>;
  if (it.status === "dikonfirmasi") return <span className="pill ok">Dikonfirmasi guru</span>;
  if (it.status === "perlu_cek") return <span className="pill warn">Perlu dicek</span>;
  return <span className="pill info">Dinilai AI</span>;
}

function SheetDetail({ programId, id, onClose, onSaved }: { programId: number; id: number; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"ocr" | "edit" | "nilai">("edit");
  const [answers, setAnswers] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/asesmen/${programId}/sheets/${id}`;

  const load = useCallback(async () => {
    const r = await fetch(base, { cache: "no-store" });
    if (!r.ok) { setMsg({ ok: false, text: "Gagal memuat lembar." }); return; }
    const j = (await r.json()) as Detail;
    setD(j);
    setAnswers(j.answers.length ? j.answers : Array(10).fill(""));
    setScores((j.grade?.butir ?? []).map((b) => b.skor));
  }, [base]);
  useEffect(() => { setD(null); setMsg(null); void load(); }, [load]);

  async function save(mode: "regrade" | "plain" | "confirm") {
    setBusy(mode);
    setMsg(null);
    try {
      const r = await fetch(base, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, regrade: mode === "regrade", scores: mode === "regrade" ? undefined : scores, confirm: mode === "confirm" }),
      });
      const j = await r.json().catch(() => ({ ok: false, error: `Gagal (kode ${r.status}).` }));
      if (j.ok) {
        setMsg({ ok: true, text: mode === "regrade" ? `Disimpan dan dinilai ulang: ${j.total}/100.` : mode === "confirm" ? `Dikonfirmasi: ${j.total}/100 masuk rekap nilai.` : `Disimpan: ${j.total}/100.` });
        await load();
        onSaved();
      } else setMsg({ ok: false, text: j.error ?? "Gagal menyimpan." });
    } catch {
      setMsg({ ok: false, text: "Koneksi terputus." });
    }
    setBusy("");
  }

  if (!d) return <div className="card"><p className="muted" style={{ margin: 0 }}>Memuat lembar…</p></div>;
  const dl = (f: string) => `/download/asesmen-hasil/${programId}?sheet=${id}&file=${f}${d.is_test ? "&test=1" : ""}`;
  const total = scores.reduce((a, b) => a + b, 0);
  const dirty = answers.join("\u0001") !== d.answers.join("\u0001") || scores.join(",") !== (d.grade?.butir ?? []).map((b) => b.skor).join(",");

  return (
    <div className="card" style={{ borderColor: "var(--primary, #4361ee)" }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0 }}>{d.name} <span className="muted small">· NIS {d.nis} · {d.level}</span></h2>
          <div className="muted small">{d.title} · Minggu ke-{d.weekGlobal}{d.is_test ? " · DATA UJI" : ""}</div>
        </div>
        <button className="btn sm" onClick={onClose}>Tutup ✕</button>
      </div>
      {d.hold && <div className="notice warn">Nama di kertas berbeda dari murid terdaftar. Nilai belum masuk rekap sampai Anda memeriksa lalu menekan <strong>Konfirmasi</strong>. {d.note}</div>}
      {!d.hold && d.note && <div className="notice warn">{d.note}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 14, alignItems: "start" }}>
        {/* Kiri: scan asli */}
        <div style={{ position: "sticky", top: 8 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>Scan asli</div>
          {d.has_scan ? (
            <a href={`${base}/scan`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/scan`} alt={`Scan ${d.name}`} style={{ width: "100%", maxHeight: "78vh", objectFit: "contain", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10, background: "#fff" }} />
            </a>
          ) : <div className="muted small">Scan tidak tersimpan.</div>}
        </div>

        {/* Kanan: transkrip / edit / nilai */}
        <div>
          <div className="chips" style={{ marginBottom: 8 }}>
            <button className={`chip ${tab === "ocr" ? "on" : ""}`} onClick={() => setTab("ocr")}>Transkrip OCR</button>
            <button className={`chip ${tab === "edit" ? "on" : ""}`} onClick={() => setTab("edit")}>Edit jawaban</button>
            <button className={`chip ${tab === "nilai" ? "on" : ""}`} onClick={() => setTab("nilai")}>Penilaian · {total}/100</button>
          </div>

          {tab === "ocr" && (
            <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
              {d.keys.map((k) => (
                <li key={k.no} style={{ marginBottom: 8 }}><strong>{k.question}</strong><div style={{ whiteSpace: "pre-wrap" }}>{d.ocr[k.no - 1] || <span className="muted">(kosong)</span>}</div></li>
              ))}
            </ol>
          )}

          {tab === "edit" && (
            <div>
              <p className="muted small" style={{ marginTop: 0 }}>Samakan dengan scan di sebelah. Perbaiki salah baca, lalu <strong>Simpan &amp; nilai ulang</strong>.</p>
              {d.keys.map((k) => (
                <div key={k.no} style={{ marginBottom: 10 }}>
                  <label className="small" style={{ fontWeight: 700 }}>{k.no}. {k.question}</label>
                  <textarea className="input" rows={3} style={{ width: "100%", resize: "vertical" }} value={answers[k.no - 1] ?? ""} onChange={(e) => setAnswers((a) => a.map((x, i) => (i === k.no - 1 ? e.target.value : x)))} />
                  <details className="small muted"><summary>Kunci jawaban</summary>{k.expected}</details>
                </div>
              ))}
            </div>
          )}

          {tab === "nilai" && (
            <div>
              <div style={{ textAlign: "right", color: RED, fontWeight: 800, fontSize: 38, lineHeight: 1 }}>{total}<span style={{ fontSize: 16 }}> /100</span></div>
              {d.keys.map((k) => {
                const b = d.grade?.butir[k.no - 1];
                return (
                  <div key={k.no} style={{ margin: "10px 0", paddingBottom: 8, borderBottom: "1px solid var(--line, #eee)" }}>
                    <div className="small"><strong>{k.no}. {k.question}</strong></div>
                    <div className="small" style={{ whiteSpace: "pre-wrap" }}>{answers[k.no - 1] || <span className="muted">(kosong)</span>}</div>
                    <div className="row" style={{ alignItems: "center", gap: 8, marginTop: 4 }}>
                      <select className="input" style={{ width: 90, minHeight: 34, padding: "2px 6px", color: RED, fontWeight: 700 }} value={scores[k.no - 1] ?? 0} onChange={(e) => setScores((s) => s.map((x, i) => (i === k.no - 1 ? Number(e.target.value) : x)))} aria-label={`Nilai soal ${k.no}`}>
                        <option value={10}>10</option><option value={5}>5</option><option value={0}>0</option>
                      </select>
                      <span className="small" style={{ color: RED, fontStyle: "italic" }}>{b?.komentar}{b?.tahan ? " (ditahan: ada bagian tidak terbaca)" : ""}</span>
                    </div>
                  </div>
                );
              })}
              <h3 style={{ marginBottom: 4 }}>Evaluasi</h3>
              {d.evaluasi.map((e) => <div key={e.label} className="small" style={{ marginBottom: 8 }}><strong>{e.label}</strong><div>{e.text}</div></div>)}
              <p className="muted small">Evaluasi disusun ulang saat Anda menekan “Simpan &amp; nilai ulang”.</p>
            </div>
          )}

          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn primary" disabled={!!busy} onClick={() => void save("regrade")}>{busy === "regrade" ? "Menilai…" : "Simpan & nilai ulang (AI)"}</button>
            <button className="btn" disabled={!!busy || !dirty} onClick={() => void save("plain")}>{busy === "plain" ? "Menyimpan…" : "Simpan"}</button>
            <button className="btn" disabled={!!busy || d.status === "dikonfirmasi" && !dirty} onClick={() => void save("confirm")}>{busy === "confirm" ? "…" : "✓ Konfirmasi sudah dicek"}</button>
          </div>
          {msg && <div className={`notice ${msg.ok ? "ok" : "err"}`} style={{ marginTop: 8 }}>{msg.text}</div>}
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <span className="muted small">Unduh:</span>
            <a className="btn sm" href={dl("1")}>1 Transkrip</a><a className="btn sm" href={dl("2")}>2 Editable</a><a className="btn sm" href={dl("3")}>3 Penilaian</a><a className="btn sm" href={dl("4")}>4 Evaluasi</a><a className="btn sm" href={dl("pdf")}>PDF</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HasilAsesmen({ programId, week, weekGlobal, admin, test, tick }: { programId: number; week: number; weekGlobal: number; admin: boolean; test: boolean; tick: string }) {
  const [view, setView] = useState<"asli" | "hasil">("hasil");
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [level, setLevel] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const qs = `week=${week}${test ? "&test=1" : ""}`;

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/asesmen/${programId}/sheets?${qs}`, { cache: "no-store" });
      if (r.ok) setItems((await r.json()) as Item[]);
    } catch { /* coba lagi pada putaran berikutnya */ }
  }, [programId, qs]);
  useEffect(() => { void load(); }, [load, tick]);
  useEffect(() => { setOpen(null); }, [week, test]);

  const zip = (kind: string) => `/download/asesmen-hasil/${programId}?${qs}&kind=${kind}${level ? `&level=${level}` : ""}`;
  const openIt = (id: number) => { setOpen(id); setTimeout(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };

  return (
    <div className="card" ref={top}>
      <div className="row between" style={{ marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>3. Hasil per murid · Minggu ke-{weekGlobal}{test ? " · UJI COBA" : ""}</h2>
        <div className="chips">
          <button className={`chip ${view === "asli" ? "on" : ""}`} onClick={() => setView("asli")}>📁 Folder Asli</button>
          <button className={`chip ${view === "hasil" ? "on" : ""}`} onClick={() => setView("hasil")}>📁 Hasil Penilaian</button>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {view === "asli" ? "Scan jawaban asli, dikelompokkan per level. Klik “Bandingkan” untuk melihat scan berdampingan dengan hasilnya." : "Tiap murid punya 4 berkas: Transkrip OCR, Jawaban Editable, Penilaian (pulpen merah), dan Evaluasi. Klik “Buka” untuk memeriksa dan mengoreksi."}
      </p>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <select className="input" style={{ width: "auto", minHeight: 34, padding: "2px 8px" }} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level untuk unduhan">
          <option value="">Semua level</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {view === "asli" ? <a className="btn sm" href={zip("asli")}>Unduh Folder Asli (ZIP)</a> : (
          <>
            <a className="btn sm" href={zip("hasil")}>Unduh Hasil (ZIP, docx)</a>
            <a className="btn sm" href={zip("pdf")}>Unduh PDF per murid (ZIP)</a>
          </>
        )}
        <a className="btn sm" href={zip("semua")}>Semua folder (Asli + Hasil)</a>
      </div>

      {open !== null && <SheetDetail key={open} programId={programId} id={open} onClose={() => setOpen(null)} onSaved={() => void load()} />}

      {items === null ? <p className="muted">Memuat…</p> : items.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>Belum ada lembar yang dinilai untuk minggu ini{test ? " (mode uji)" : ""}. Hasil muncul setelah unggahan selesai diproses.</p>
      ) : (
        LEVELS.map((lv) => {
          const list = items.filter((x) => x.level === lv);
          if (!list.length) return null;
          return (
            <details key={lv} open style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, padding: "6px 0" }}>{lv} <span className="muted small">({list.length} murid)</span></summary>
              <div>
                {list.map((it) => (
                  <div key={it.id} className="row between" style={{ gap: 8, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--line, #eee)", alignItems: "center" }}>
                    <div style={{ minWidth: 180, flex: "1 1 200px" }}>
                      <strong>{it.name}</strong> <span className="muted small">· {it.nis}</span>
                      <div className="small muted">{it.title}</div>
                    </div>
                    {view === "hasil" && <div style={{ color: RED, fontWeight: 800, minWidth: 56 }}>{it.total ?? "-"}<span className="small">/100</span></div>}
                    <div><StatusPill it={it} />{it.edited && <span className="pill" style={{ marginLeft: 4 }}>Diedit</span>}</div>
                    <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                      {view === "asli" ? (
                        <>
                          <button className="btn sm" onClick={() => openIt(it.id)}>Bandingkan</button>
                          {it.has_scan && <a className="btn sm" href={`/download/asesmen-hasil/${programId}?sheet=${it.id}&file=scan${test ? "&test=1" : ""}`}>Unduh</a>}
                        </>
                      ) : (
                        <>
                          <button className="btn sm primary" onClick={() => openIt(it.id)}>Buka</button>
                          {["1", "2", "3", "4"].map((n) => <a key={n} className="btn sm" title={["Transkrip OCR", "Jawaban Editable", "Penilaian", "Evaluasi"][Number(n) - 1]} href={`/download/asesmen-hasil/${programId}?sheet=${it.id}&file=${n}${test ? "&test=1" : ""}`}>{n}</a>)}
                          <a className="btn sm" href={`/download/asesmen-hasil/${programId}?sheet=${it.id}&file=pdf${test ? "&test=1" : ""}`}>PDF</a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
