"use server";

import { PDFDocument } from "pdf-lib";
import { sql } from "@/lib/db";
import { fail, ok, refresh, run, toInt } from "@/lib/act";
import { getProgram } from "@/lib/q";
import { saveResult } from "@/lib/asesmen";
import type { Result } from "@/lib/result";

/** Isi/ubah nilai manual satu murid (kosongkan untuk menghapus). */
export async function saveScore(programId: number, studentId: number, week: number, raw: string): Promise<Result> {
  return run(async (u) => {
    const p = await getProgram(programId);
    if (!p || (u.role === "guru" && u.institution_id !== p.institution_id)) return fail("Program tidak ditemukan.");
    if (!Number.isInteger(week) || week < 1 || week > p.weeks) return fail("Minggu tidak valid.");
    const t = raw.trim().replace(",", ".");
    if (t === "") {
      await sql().query(`DELETE FROM assessment_results WHERE program_id = $1 AND student_id = $2 AND week = $3`, [programId, studentId, week]);
      return ok("Nilai dihapus.");
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 100) return fail("Nilai harus 0-100.");
    const ok1 = await sql().query(`SELECT 1 FROM program_students WHERE program_id = $1 AND student_id = $2`, [programId, studentId]);
    if (!ok1.length) return fail("Murid tidak ada di program ini.");
    await saveResult(programId, studentId, week, Math.round(n * 10) / 10, "manual", null, u.id);
    return ok("Nilai disimpan.");
  });
}

/** Admin: pasang/ganti template asesmen (PDF 1 halaman) untuk satu judul, plus rubrik opsional. */
export async function uploadTemplate(fd: FormData): Promise<Result> {
  return run(async () => {
    const bookId = toInt(fd.get("book"), 1, 1_000_000);
    const f = fd.get("pdf");
    const rubric = String(fd.get("rubric") ?? "").trim().slice(0, 4000) || null;
    if (!bookId) return fail("Pilih judul buku.");
    const has = await sql().query(`SELECT 1 FROM books WHERE id = $1`, [bookId]);
    if (!has.length) return fail("Buku tidak ditemukan.");
    if (!(f instanceof File) || !f.size) {
      // hanya rubrik yang diubah
      if (!rubric) return fail("Pilih file PDF atau isi rubrik.");
      const r = await sql().query(`UPDATE assessment_templates SET rubric = $2, updated_at = now() WHERE book_id = $1 RETURNING 1`, [bookId, rubric]);
      return r.length ? ok("Rubrik disimpan.") : fail("Buku ini belum punya template PDF. Unggah PDF-nya dulu.");
    }
    if (f.size > 2 * 1024 * 1024) return fail("PDF maksimal 2 MB.");
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(new Uint8Array(await f.arrayBuffer()));
    } catch {
      return fail("File bukan PDF yang valid.");
    }
    if (doc.getPageCount() !== 1) return fail(`PDF harus 1 halaman (file ini ${doc.getPageCount()} halaman). Pisahkan dulu per judul.`);
    const b64 = Buffer.from(await doc.save()).toString("base64");
    await sql().query(
      `INSERT INTO assessment_templates (book_id, pdf_b64, rubric) VALUES ($1, $2, $3)
       ON CONFLICT (book_id) DO UPDATE SET pdf_b64 = EXCLUDED.pdf_b64, rubric = COALESCE(EXCLUDED.rubric, assessment_templates.rubric), updated_at = now()`,
      [bookId, b64, rubric],
    );
    refresh();
    return ok("Template asesmen disimpan.");
  }, "admin");
}
