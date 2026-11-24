"use client";

import { useState } from "react";
import { uploadTemplate } from "@/app/actions/asesmen";
import { ActionForm, Notice } from "@/components/ui";
import type { Result } from "@/lib/result";

export default function TemplateStock({ items }: { items: { id: number; title: string; has: boolean }[] }) {
  const [r, setR] = useState<Result | null>(null);
  const missing = items.filter((x) => !x.has);
  return (
    <div className="card" id="stok-asesmen">
      <h2>Stok Asesmen</h2>
      <p className="muted small">
        {items.length - missing.length} dari {items.length} judul sudah punya lembar asesmen (PDF 1 halaman). Pasang atau ganti template satu judul di sini.
        Rubrik/kunci jawaban (opsional) dipakai penilai otomatis sebagai acuan.
      </p>
      {missing.length > 0 && <div className="notice warn">Belum ada asesmen: {missing.map((x) => x.title).join(", ")}.</div>}
      <Notice r={r} />
      <ActionForm action={uploadTemplate} submitLabel="Simpan" onDone={setR}>
        <div className="fields">
          <div>
            <label className="f" htmlFor="tpl-book">Judul buku</label>
            <select id="tpl-book" name="book" className="input" required defaultValue="">
              <option value="" disabled>Pilih judul…</option>
              {items.map((x) => <option key={x.id} value={x.id}>{x.has ? "✓ " : "• "}{x.title}</option>)}
            </select>
          </div>
          <div>
            <label className="f" htmlFor="tpl-pdf">PDF asesmen (1 halaman)</label>
            <input id="tpl-pdf" name="pdf" type="file" accept="application/pdf" className="input" />
          </div>
        </div>
        <label className="f" htmlFor="tpl-rubric">Rubrik / kunci jawaban (opsional)</label>
        <textarea id="tpl-rubric" name="rubric" className="input" rows={3} placeholder="Mis. soal 1: Ego, Id, Superego. Soal 6: Carl Jung…" />
      </ActionForm>
    </div>
  );
}
