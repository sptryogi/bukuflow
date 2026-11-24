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
type Log = { id: number; name: string; state: "proses" | "ok" | "cek" | "gagal"; text: string };

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
    const base = seq.current;
    seq.current += files.length;
    setLog((l) => [...files.map((f, i) => ({ id: base + i, name: f.name, state: "proses" as const, text: "Membaca…" })), ...l]);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        let upd: Pick<Log, "state" | "text">;
        try {
          const fd = new FormData();
          fd.set("week", String(week));
          fd.set("file", await shrink(files[i]), "scan.jpg");
          if (studentId) fd.set("student", String(studentId));
          const res = await fetch(`/api/asesmen/${programId}/upload`, { method: "POST", body: fd });
          const j = await res.json().catch(() => ({ ok: false, error: `Gagal (kode ${res.status}). Coba foto lebih kecil.` }));
          upd = j.ok
            ? { state: j.status === "perlu_cek" ? "cek" : "ok", text: `${j.student.nis} ${j.student.name}: nilai ${j.score}${j.status === "perlu_cek" ? ` (perlu dicek: ${j.note})` : ""}` }
            : { state: "gagal", text: j.error };
        } catch {
          upd = { state: "gagal", text: "Koneksi terputus." };
        }
        setLog((l) => l.map((x) => (x.id === base + i ? { ...x, ...upd } : x)));
      }
    };
    await Promise.all([worker(), worker()]);
    setBusy(false);
    await load(week);
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
          Foto/scan <strong>satu lembar per file</strong> (JPG/PNG), boleh banyak sekaligus. Sistem membaca NIS di kertas untuk mencocokkan murid.{" "}
          {admin ? "Admin tidak dibatasi waktu." : <>Unggah dibuka sampai <strong>{wib(cur.closes)}</strong>.</>}
        </p>
        {!d.graderReady && <div className="notice warn">Penilaian otomatis belum diaktifkan admin. Nilai tetap bisa diisi manual pada tabel di bawah.</div>}
        <label className={`btn ${canUpload && d.graderReady && !busy ? "primary" : ""}`} style={canUpload && d.graderReady ? undefined : { opacity: 0.5, pointerEvents: "none" }}>
          {busy ? "Memproses…" : "Pilih foto / scan"}
          <input type="file" accept="image/*" multiple hidden disabled={busy || !canUpload || !d.graderReady} onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) void sendAll(f); }} />
        </label>
        {!canUpload && <span className="muted small"> {cur.state === "belum" ? "Belum dibuka." : "Batas unggah sudah lewat (hubungi admin)."}</span>}
        {log.length > 0 && (
          <ul className="small" style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {log.slice(0, 40).map((x) => (
              <li key={x.id} style={{ color: x.state === "gagal" ? "var(--danger)" : x.state === "cek" ? "var(--warn)" : undefined }}>
                {x.state === "proses" ? "⏳" : x.state === "ok" ? "✅" : x.state === "cek" ? "⚠️" : "❌"} <span className="muted">{x.name}</span> · {x.text}
              </li>
            ))}
          </ul>
        )}
      </div>

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
                        <input type="file" accept="image/*" hidden disabled={busy || !canUpload || !d.graderReady} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendAll([f], r.student_id); }} />
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
