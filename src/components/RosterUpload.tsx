"use client";

import { useState, useTransition } from "react";
import { commitRoster, copyRoster, previewRoster } from "@/app/actions/program";
import { Badge, Notice, RunButton } from "@/components/ui";
import type { Level } from "@/lib/engine";
import type { Preview, Result } from "@/lib/result";

export default function RosterUpload({
  programId,
  institutionId,
  hasRoster,
  running,
  copyFrom,
}: {
  programId: number;
  institutionId: number;
  hasRoster: boolean;
  running: boolean;
  copyFrom: { id: number; label: string } | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const form = (f: File) => {
    const fd = new FormData();
    fd.set("program_id", String(programId));
    fd.set("file", f);
    return fd;
  };

  return (
    <div className="card">
      <h2>{hasRoster ? "Perbarui data murid" : "Unggah data murid"}</h2>
      <p className="muted small">
        1) Unduh template, 2) isi NIS, Nama Murid, dan Level (dropdown), 3) unggah di sini, 4) periksa pratinjau lalu simpan.
        {running && " Program sudah berjalan: minggu yang telah dirilis tidak berubah, hanya minggu berikutnya yang dihitung ulang."}
      </p>
      <div className="row" style={{ marginBottom: 10 }}>
        <a className="btn" href={`/download/template?institution=${institutionId}`}>Unduh template Excel</a>
        {copyFrom && (
          <RunButton run={() => copyRoster(programId, copyFrom.id)} onResult={setResult} confirm={`Pakai daftar murid dari ${copyFrom.label}?`}>
            Pakai murid dari program sebelumnya
          </RunButton>
        )}
      </div>

      <input
        type="file"
        accept=".xlsx"
        className="input"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPreview(null);
          setResult(null);
        }}
      />
      <div className="form-actions">
        <button
          className="btn"
          disabled={!file || pending}
          onClick={() => start(async () => { setResult(null); setPreview(await previewRoster(form(file!))); })}
        >
          {pending ? "Memeriksa…" : "Periksa file"}
        </button>
      </div>

      {preview && !preview.ok && <div className="notice err">{preview.error}</div>}
      {preview?.ok && (
        <div style={{ marginTop: 10 }}>
          <p>
            <strong>{preview.total} murid terbaca</strong>
            {" · "}Pemula {preview.counts.Pemula} · Madya {preview.counts.Madya} · Mahir {preview.counts.Mahir}
          </p>
          {preview.errors.length > 0 && (
            <div className="notice err">
              <strong>{preview.errors.length} masalah ditemukan. Perbaiki file lalu periksa ulang:</strong>
              <ul>{preview.errors.slice(0, 15).map((x, i) => <li key={i}>{x}</li>)}{preview.errors.length > 15 && <li>…dan {preview.errors.length - 15} lainnya</li>}</ul>
            </div>
          )}
          <div className="tablewrap" style={{ maxHeight: 260 }}>
            <table>
              <thead><tr><th>NIS</th><th>Nama Murid</th><th>Level</th></tr></thead>
              <tbody>
                {preview.sample.map((r) => (
                  <tr key={r.nis}><td>{r.nis}</td><td>{r.name}</td><td><Badge level={r.level as Level} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total > preview.sample.length && <p className="muted small">Menampilkan {preview.sample.length} dari {preview.total} murid.</p>}
          <div className="form-actions">
            <button
              className="btn primary"
              disabled={pending || preview.errors.length > 0 || preview.total === 0}
              onClick={() => start(async () => { const r = await commitRoster(form(file!)); setResult(r); if (r.ok) setPreview(null); })}
            >
              {pending ? "Menyimpan…" : "Simpan & buat alokasi"}
            </button>
          </div>
        </div>
      )}
      <Notice r={result} />
    </div>
  );
}
