"use client";

import { useMemo, useState } from "react";
import { LEVELS, type Book, type Level } from "@/lib/engine";
import { deleteBook, importBooks, saveBook } from "@/app/actions/admin";
import { ActionForm, Badge, Modal, Notice, RunButton } from "@/components/ui";
import type { Result } from "@/lib/result";

export default function BukuClient({ books }: { books: Book[] }) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Level | "Semua">("Semua");
  const [edit, setEdit] = useState<Book | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<Result | null>(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return books.filter((b) => (level === "Semua" || b.level === level) && (!t || b.title.toLowerCase().includes(t)));
  }, [books, q, level]);

  return (
    <>
      <div className="row between">
        <div>
          <h1>Katalog Buku</h1>
          <p className="sub" style={{ marginBottom: 12 }}>{books.length} judul{LEVELS.map((l) => ` · ${l} ${books.filter((b) => b.level === l).length}`).join("")}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setImporting(true)}>Tempel dari Excel</button>
          <button className="btn primary" onClick={() => setEdit("new")}>+ Tambah buku</button>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input grow" style={{ minWidth: 200 }} placeholder="Cari judul…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {(["Semua", ...LEVELS] as const).map((l) => <button key={l} className={`chip ${level === l ? "on" : ""}`} onClick={() => setLevel(l)}>{l}</button>)}
        </div>
      </div>
      <Notice r={notice} />
      <div className="tablewrap">
        <table className="rtable">
          <thead><tr><th>Judul</th><th>Level</th><th /></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td data-label="Judul" style={{ fontWeight: 600 }}>{b.title}</td>
                <td data-label="Level"><Badge level={b.level} /></td>
                <td className="act nowrap">
                  <button className="btn sm" onClick={() => setEdit(b)}>Edit</button>{" "}
                  <RunButton className="btn sm danger" run={() => deleteBook(b.id)} onResult={setNotice} confirm={`Hapus "${b.title}"?`}>Hapus</RunButton>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="muted">Tidak ada buku.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit === "new" ? "Tambah buku" : "Edit buku"} onClose={() => setEdit(null)}>
          <ActionForm action={saveBook} onDone={(r) => { setNotice(r); setEdit(null); }}>
            {edit !== "new" && <input type="hidden" name="id" value={edit.id} />}
            <div className="fields">
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="f" htmlFor="title">Judul</label>
                <input id="title" name="title" className="input" defaultValue={edit === "new" ? "" : edit.title} required maxLength={200} autoFocus />
              </div>
              <div>
                <label className="f" htmlFor="level">Level</label>
                <select id="level" name="level" className="input" defaultValue={edit === "new" ? "Pemula" : edit.level}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
              </div>
            </div>
          </ActionForm>
        </Modal>
      )}
      {importing && (
        <Modal title="Tambah banyak buku" onClose={() => setImporting(false)}>
          <p className="muted small">Satu buku per baris: <strong>Judul;Level</strong> (dipisah tab atau titik koma, bisa disalin dari Excel).</p>
          <ActionForm action={importBooks} submitLabel="Impor" onDone={(r) => { setNotice(r); setImporting(false); }}>
            <label className="f" htmlFor="dl">Level bawaan (bila kolom level kosong)</label>
            <select id="dl" name="default_level" className="input" style={{ marginBottom: 10 }}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
            <textarea name="text" className="input" placeholder={"Si Kancil;Pemula\nPerang dan Damai;Mahir"} required />
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
