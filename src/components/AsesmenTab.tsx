"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveScore } from "@/app/actions/asesmen";

type Row = { student_id: number; nis: string; name: string; level: string; book_id: number | null; title: string | null; has_tpl: boolean; score: number | null; status: string | null };
type Wk = { week: number; global: number; opens: number; closes: number; state: "belum" | "buka" | "tutup"; graded: number };
type Data = {
  now: number; total: number; graderReady: boolean; week: number; rows: Row[]; weeks: Wk[];
  settings: { printDay: number; deadlineHours: number };
  downloads: { week: number; kind: string; items: number; at: string; who: string | null }[] | null;
};
type Log = { id: number; name: string; state: "proses" | "ok" | "gagal"; text: string };
type QS = { stat: { menunggu: number; diproses: number; selesai: number; perlu_cek: number; gagal: number }; failed: { id: number; label: string | null; note: string | null }[] };

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** Buka PDF (1 file = banyak halaman) di browser; tiap halaman dirender jadi JPEG saat dibutuhkan (hemat memori). */
async function openPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return {
    n: doc.numPages,
    async page(i: number): Promise<Blob> {
      const pg = await doc.getPage(i);
      const v1 = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: Math.min(3, 1800 / Math.max(v1.width, v1.height)) });
      const c = document.createElement("canvas");
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      await pg.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
      pg.cleanup();
      if (!b) throw new Error("render");
      return b;
    },
  };
}

const wib = (ms: number) =>
  new Date(ms).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", ":") + " WIB";

/** Perkecil foto HP (maks 1800 px, JPEG) supaya muat batas unggah 4 MB dan cepat dibaca. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (b) return b;
  } catch {
    /* format tak dikenali browser: kirim apa adanya */
  }
  return file;
}

function ScoreInput({ programId, week, row, onSaved }: { programId: number; week: number; row: Row; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span>
      <input
        key={`${row.student_id}:${row.score}`}
        className="input"
        style={{ width: 76, minHeight: 34, padding: "4px 8px" }}
        inputMode="decimal"
        defaultValue={row.score ?? ""}
        placeholder="-"
        aria-label={`Nilai ${row.name}`}
        disabled={busy}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        onBlur={async (e) => {
          const v = e.target.value.trim();
          if (v === String(row.score ?? "")) return;
          setBusy(true);
          const r = await saveScore(programId, row.student_id, week, v);
          setBusy(false);
          if (r.ok) { setErr(""); onSaved(); } else setErr(r.error);
        }}
      />
      {err && <div className="small" style={{ color: "var(--danger)" }}>{err}</div>}
    </span>
  );
}

export default function AsesmenTab({ programId, admin }: { programId: number; admin: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [week, setWeek] = useState<number | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const seq = useRef(0);
  const pollUntil = useRef(0);
  const [qs, setQs] = useState<QS | null>(null);
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async (w?: number | null) => {
    try {
      const r = await fetch(`/api/asesmen/${programId}${w ? `?week=${w}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as Data;
      setD(j);
      setWeek(j.week);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat.");
    }
  }, [programId]);

  useEffect(() => { void load(null); }, [load]);

  const loadQ = useCallback(async () => {
    if (!admin || week === null) return;
    try {
      const r = await fetch(`/api/asesmen/${programId}/queue?week=${week}`, { cache: "no-store" });
      if (r.ok) setQs((await r.json()) as QS);
    } catch { /* abaikan, coba lagi pada putaran berikutnya */ }
  }, [admin, programId, week]);

  // Segarkan berkala: admin melihat progres antrean; semua pengguna melihat nilai yang masuk setelah unggah.
  useEffect(() => {
    if (week === null) return;
    void loadQ();
    const t = setInterval(() => {
      void loadQ();
      if (Date.now() < pollUntil.current || (admin && qs && (qs.stat.menunggu > 0 || qs.stat.diproses > 0))) void load(week);
    }, 8000);
    return () => clearInterval(t);
  }, [week, admin, load, loadQ, qs]);

  if (err) return <div className="notice err">{err}</div>;
  if (!d || week === null) return <p className="muted">Memuat…</p>;
  const cur = d.weeks.find((x) => x.week === week);
  if (!cur) return <div className="notice warn">Belum ada minggu yang dirilis.</div>;
  const canPrint = admin || cur.state !== "belum";
  const canUpload = admin || cur.state === "buka";
  const noTpl = d.rows.filter((r) => !r.has_tpl);
  const t = q.trim().toLowerCase();
  const rows = d.rows.filter((r) => !t || r.name.toLowerCase().includes(t) || r.nis.toLowerCase().includes(t));
  const anyScore = d.weeks.some((x) => x.graded > 0);

  async function sendAll(files: File[], studentId?: number) {
    setBusy(true);
    setOkMsg("");
    // Kembangkan PDF menjadi halaman-halaman; foto jadi 1 item. Halaman dirender/diperkecil saat giliran dikirim.
    type Item = { name: string; get: () => Promise<Blob> };
    const items: Item[] = [];
    const bad: string[] = [];
    for (const f of files) {
      if (isPdf(f)) {
        try {
          const pdf = await openPdf(f);
          const n = studentId ? 1 : pdf.n; // unggah untuk 1 murid: cukup halaman pertama
          for (let i = 1; i <= n; i++) items.push({ name: pdf.n > 1 ? `${f.name} hal ${i}` : f.name, get: () => pdf.page(i) });
        } catch {
          bad.push(f.name);
        }
      } else items.push({ name: f.name, get: () => shrink(f) });
    }
    const base = seq.current;
    seq.current += items.length + bad.length;
    setLog((l) => [
      ...bad.map((n, i) => ({ id: base + items.length + i, name: n, state: "gagal" as const, text: "PDF tidak dapat dibuka." })),
      ...items.map((f, i) => ({ id: base + i, name: f.name, state: "proses" as const, text: "Mengunggah…" })),
      ...l,
    ]);
    let next = 0;
    let okN = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        let upd: Pick<Log, "state" | "text">;
        try {
          const fd = new FormData();
          fd.set("week", String(week));
          fd.set("label", items[i].name);
          fd.set("file", await items[i].get(), "scan.jpg");
          if (studentId) fd.set("student", String(studentId));
          const res = await fetch(`/api/asesmen/${programId}/upload`, { method: "POST", body: fd });
          const j = await res.json().catch(() => ({ ok: false, error: `Gagal (kode ${res.status}). Coba file lebih kecil.` }));
          if (j.ok) okN++;
          upd = j.ok ? { state: "ok", text: "Diterima" } : { state: "gagal", text: j.error };
        } catch {
          upd = { state: "gagal", text: "Koneksi terputus." };
        }
        setLog((l) => l.map((x) => (x.id === base + i ? { ...x, ...upd } : x)));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(false);
    if (okN) {
      setOkMsg(`Unggah berhasil: ${okN} lembar diterima. Penilaian berjalan di latar belakang; nilai muncul di tabel setelah selesai.${admin ? "" : " Anda boleh menutup halaman ini."}`);
      pollUntil.current = Date.now() + 20 * 60_000;
    }
    await load(week);
    void loadQ();
  }

  return (
    <>
      <div className="card">
        <h2>Asesmen Membaca</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Cetak lembar asesmen tiap murid sesuai buku minggu itu, murid mengerjakan, lalu foto/scan hasilnya dan unggah di sini. Nilai terbaca otomatis dan masuk ke riwayat nilai.
          Setiap minggu pola yang sama berulang untuk judul buku berikutnya.
        </p>
      </div>

      <div className="chips" style={{ marginBottom: 10 }}>
        {d.weeks.map((w) => (
          <button key={w.week} className={`chip ${w.week === week ? "on" : ""}`} onClick={() => void load(w.week)}>
            Minggu {w.global}{w.graded > 0 ? ` · ${w.graded}/${d.total}` : ""}
          </button>
        ))}
      </div>

      <div className="card">
        <h2>1. Cetak · Minggu ke-{cur.global}</h2>
        <p className="muted small">
          {cur.state === "belum" ? <>Dibuka <strong>{wib(cur.opens)}</strong>{admin ? " (admin bisa mengunduh sekarang)." : "."}</> : <>Sudah dibuka sejak {wib(cur.opens)}.</>}{" "}
          Isi lembar otomatis: NIS, Nama, dan Tanggal. Satu murid satu PDF, dikemas dalam satu ZIP.
        </p>
        {canPrint ? (
          <div className="row">
            <a className="btn primary" href={`/download/asesmen/${programId}?week=${cur.week}`}>Unduh semua (ZIP)</a>
          </div>
        ) : <button className="btn" disabled>Belum dibuka</button>}
        {noTpl.length > 0 && (
          <div className="notice warn">{noTpl.length} murid belum bisa dicetak karena template asesmen judulnya belum tersedia{admin ? " (lengkapi di menu Buku → Stok Asesmen)." : ". Hubungi admin."}</div>
        )}
      </div>

      <div className="card">
        <h2>2. Unggah hasil</h2>
        <p className="muted small">
          Unggah foto/scan (JPG/PNG) <strong>atau PDF</strong>: satu file per murid, atau <strong>satu PDF berisi banyak halaman</strong> (satu halaman = satu murid). Boleh banyak file sekaligus. Sistem membaca NIS di kertas untuk mencocokkan murid, lalu menilai di latar belakang.{" "}
          {admin ? "Admin tidak dibatasi waktu." : <>Unggah dibuka sampai <strong>{wib(cur.closes)}</strong>.</>}
        </p>
        {!d.graderReady && <div className="notice warn">Penilaian otomatis belum diaktifkan admin. Nilai tetap bisa diisi manual pada tabel di bawah.</div>}
        <label className={`btn ${canUpload && d.graderReady && !busy ? "primary" : ""}`} style={canUpload && d.graderReady ? undefined : { opacity: 0.5, pointerEvents: "none" }}>
          {busy ? "Mengunggah…" : "Pilih foto / scan / PDF"}
          <input type="file" accept="image/*,application/pdf" multiple hidden disabled={busy || !canUpload || !d.graderReady} onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) void sendAll(f); }} />
        </label>
        {!canUpload && <span className="muted small"> {cur.state === "belum" ? "Belum dibuka." : "Batas unggah sudah lewat (hubungi admin)."}</span>}
        {okMsg && <div className="notice ok" style={{ marginTop: 10 }}>✅ {okMsg}</div>}
        {log.length > 0 && (
          <ul className="small" style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {log.slice(0, 15).map((x) => (
              <li key={x.id} style={{ color: x.state === "gagal" ? "var(--danger)" : undefined }}>
                {x.state === "proses" ? "⏳" : x.state === "ok" ? "✅" : "❌"} <span className="muted">{x.name}</span> · {x.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {admin && qs && qs.stat.menunggu + qs.stat.diproses + qs.stat.selesai + qs.stat.perlu_cek + qs.stat.gagal > 0 && (() => {
        const s = qs.stat;
        const all = s.menunggu + s.diproses + s.selesai + s.perlu_cek + s.gagal;
        const done = s.selesai + s.perlu_cek + s.gagal;
        const pct = Math.round((done / all) * 100);
        return (
          <div className="card">
            <h2>Progres penilaian · Minggu ke-{cur.global}</h2>
            <div style={{ height: 10, borderRadius: 99, background: "var(--line, #e5e7eb)", overflow: "hidden", margin: "6px 0 8px" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary, #4361ee)", transition: "width .4s" }} />
            </div>
            <p className="small" style={{ margin: 0 }}>
              <strong>{done}</strong> dari <strong>{all}</strong> lembar selesai diproses ({pct}%){s.menunggu + s.diproses > 0 ? " · berjalan di latar belakang" : " · selesai"}
            </p>
            <div className="chips" style={{ marginTop: 8 }}>
              <span className="pill info">Menunggu {s.menunggu}</span>
              <span className="pill info">Diproses {s.diproses}</span>
              <span className="pill ok">Terbaca {s.selesai}</span>
              <span className="pill warn">Perlu dicek {s.perlu_cek}</span>
              <span className="pill" style={s.gagal ? { color: "var(--danger)" } : undefined}>Gagal {s.gagal}</span>
            </div>
            {qs.failed.length > 0 && (
              <>
                <ul className="small" style={{ margin: "10px 0 6px", paddingLeft: 18 }}>
                  {qs.failed.slice(0, 10).map((f) => <li key={f.id} style={{ color: "var(--danger)" }}><span className="muted">{f.label ?? `#${f.id}`}</span> · {f.note}</li>)}
                </ul>
                <button className="btn sm" onClick={async () => { await fetch(`/api/asesmen/${programId}/queue?week=${week}`, { method: "POST" }); void loadQ(); }}>Proses ulang yang gagal</button>
              </>
            )}
          </div>
        );
      })()}

      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>3. Nilai minggu ke-{cur.global} <span className="muted small">({cur.graded}/{d.total} murid)</span></h2>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Cari nama / NIS…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="tablewrap">
          <table className="rtable">
            <thead><tr><th>NIS</th><th>Nama Murid</th><th>Buku</th><th>Nilai</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id}>
                  <td data-label="NIS">{r.nis}</td>
                  <td data-label="Nama"><strong>{r.name}</strong></td>
                  <td data-label="Buku">{r.title ?? "-"}</td>
                  <td data-label="Nilai"><ScoreInput programId={programId} week={cur.week} row={r} onSaved={() => void load(week)} /></td>
                  <td data-label="Status">
                    {r.status === "dinilai" && <span className="pill ok">Terbaca</span>}
                    {r.status === "perlu_cek" && <span className="pill warn">Perlu dicek</span>}
                    {r.status === "manual" && <span className="pill info">Manual</span>}
                    {!r.status && <span className="muted small">Belum ada</span>}
                  </td>
                  <td className="act nowrap">
                    {r.has_tpl && canPrint && <a className="btn sm" href={`/download/asesmen/${programId}?week=${cur.week}&student=${r.student_id}`}>PDF</a>}{" "}
                    {r.book_id && (
                      <label className="btn sm" style={canUpload && d.graderReady && !busy ? undefined : { opacity: 0.5, pointerEvents: "none" }}>
                        Foto
                        <input type="file" accept="image/*,application/pdf" hidden disabled={busy || !canUpload || !d.graderReady} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendAll([f], r.student_id); }} />
                      </label>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="muted">Tidak ada murid.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>Nilai 0-100 (10 soal × 10). Klik kotak nilai untuk mengoreksi, lalu Enter. Baris “Perlu dicek” sebaiknya dilihat guru.</p>
      </div>

      <div className="card">
        <h2>Riwayat nilai</h2>
        <p className="muted small">Kolom: NIS, Nama Murid, Level, lalu satu kolom per minggu yang sudah punya nilai. Bertambah otomatis setiap ada nilai baru.</p>
        {anyScore ? (
          <div className="row">
            <a className="btn" href={`/download/nilai/${programId}?format=xlsx`}>Excel</a>
            <a className="btn" href={`/download/nilai/${programId}?format=pdf`}>PDF</a>
          </div>
        ) : <p className="muted small" style={{ margin: 0 }}>Belum ada nilai. Muncul setelah hasil minggu pertama diunggah.</p>}
      </div>

      {admin && d.downloads && (
        <div className="card">
          <h2>Log unduhan lembar asesmen</h2>
          <p className="muted small">Jadwal: cetak dibuka hari ke-{d.settings.printDay} sesudah rilis minggu, unggah sampai {d.settings.deadlineHours} jam sesudah rilis minggu berikutnya (atur di Ringkasan → Pengaturan).</p>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Waktu</th><th>Minggu</th><th>Oleh</th><th>Jenis</th><th className="num">Lembar</th></tr></thead>
              <tbody>
                {d.downloads.map((x, i) => (
                  <tr key={i}><td>{new Date(x.at.replace(" ", "T") + (x.at.includes("+") || x.at.endsWith("Z") ? "" : "Z")).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td><td>{(d.weeks.find((w) => w.week === x.week)?.global) ?? x.week}</td><td>{x.who ?? "-"}</td><td>{x.kind === "zip" ? "ZIP semua" : "1 murid"}</td><td className="num">{x.items}</td></tr>
                ))}
                {d.downloads.length === 0 && <tr><td colSpan={5} className="muted">Belum ada unduhan.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
