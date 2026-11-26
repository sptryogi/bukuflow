// Akses database untuk lembar jawaban (scan asli, transkrip, jawaban hasil edit, nilai) dan kunci jawaban.
import { sql } from "./db";
import type { Assessment, Key, Ocr } from "./assess";

type Row = Record<string, any>;
const q = () => sql();

export type GradeStored = Assessment & { namaRead?: string; nisRead?: string; judulRead?: string };
export type SheetFull = {
  id: number; program_id: number; student_id: number; week: number; is_test: boolean; book_id: number | null;
  nis: string; name: string; level: string; title: string | null;
  ocr: Ocr | null; answers: string[] | null; grade: GradeStored | null;
  status: "dinilai" | "perlu_cek" | "dikonfirmasi"; hold: boolean; note: string | null; scan_type: string | null; has_scan: boolean;
  updated_at: string; edited_at: string | null;
};

export async function keysOf(bookId: number): Promise<Key[]> {
  const r = await q().query(`SELECT no, question, expected FROM assessment_keys WHERE book_id = $1 ORDER BY no`, [bookId]);
  return r.map((x) => ({ no: x.no as number, question: x.question as string, expected: x.expected as string }));
}

export async function upsertSheet(a: {
  programId: number; studentId: number; week: number; isTest: boolean; bookId: number | null; scanB64: string; scanType: string;
  ocr: Ocr; answers: string[]; grade: GradeStored; status: "dinilai" | "perlu_cek"; hold: boolean; note: string; userId: number | null;
}): Promise<void> {
  await q().query(
    `INSERT INTO assessment_sheets (program_id, student_id, week, is_test, book_id, scan_b64, scan_type, ocr, answers, grade, status, hold, note, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14)
     ON CONFLICT (program_id, student_id, week, is_test) DO UPDATE SET
       book_id = EXCLUDED.book_id, scan_b64 = EXCLUDED.scan_b64, scan_type = EXCLUDED.scan_type, ocr = EXCLUDED.ocr, answers = EXCLUDED.answers,
       grade = EXCLUDED.grade, status = EXCLUDED.status, hold = EXCLUDED.hold, note = EXCLUDED.note, uploaded_by = EXCLUDED.uploaded_by,
       edited_by = NULL, edited_at = NULL, updated_at = now()`,
    [a.programId, a.studentId, a.week, a.isTest, a.bookId, a.scanB64, a.scanType, JSON.stringify(a.ocr), JSON.stringify(a.answers), JSON.stringify(a.grade), a.status, a.hold, a.note.slice(0, 500), a.userId],
  );
}

const BASE = `SELECT s.id, s.program_id, s.student_id, s.week, s.is_test, s.book_id, st.nis, st.name, ps.level, b.title,
       s.ocr, s.answers, s.grade, s.status, s.hold, s.note, s.scan_type, (s.scan_b64 IS NOT NULL) AS has_scan, s.updated_at::text AS updated_at, s.edited_at::text AS edited_at
  FROM assessment_sheets s
  JOIN students st ON st.id = s.student_id
  JOIN program_students ps ON ps.program_id = s.program_id AND ps.student_id = s.student_id
  LEFT JOIN books b ON b.id = s.book_id`;

const levelRank = (l: string) => ["Pemula", "Madya", "Mahir"].indexOf(l);
const sortSheets = (a: SheetFull, b: SheetFull) => levelRank(a.level) - levelRank(b.level) || a.nis.localeCompare(b.nis, "id", { numeric: true }) || a.id - b.id;

export async function sheetsOfWeek(programId: number, week: number, isTest: boolean): Promise<SheetFull[]> {
  const r = (await q().query(`${BASE} WHERE s.program_id = $1 AND s.week = $2 AND s.is_test = $3`, [programId, week, isTest])) as SheetFull[];
  return r.sort(sortSheets);
}

export async function sheetById(programId: number, id: number): Promise<SheetFull | null> {
  const r = (await q().query(`${BASE} WHERE s.program_id = $1 AND s.id = $2`, [programId, id])) as SheetFull[];
  return r[0] ?? null;
}

export async function scanOf(programId: number, id: number): Promise<{ b64: string; type: string } | null> {
  const r = await q().query(`SELECT scan_b64, scan_type FROM assessment_sheets WHERE program_id = $1 AND id = $2`, [programId, id]);
  return r[0]?.scan_b64 ? { b64: r[0].scan_b64 as string, type: (r[0].scan_type as string) || "image/jpeg" } : null;
}

export async function updateSheet(id: number, a: { answers: string[]; grade: GradeStored; status: "dinilai" | "perlu_cek" | "dikonfirmasi"; hold: boolean; userId: number }): Promise<void> {
  await q().query(
    `UPDATE assessment_sheets SET answers = $2::jsonb, grade = $3::jsonb, status = $4, hold = $5, edited_by = $6, edited_at = now(), updated_at = now() WHERE id = $1`,
    [id, JSON.stringify(a.answers), JSON.stringify(a.grade), a.status, a.hold, a.userId],
  );
}

export async function deleteTestData(programId: number): Promise<number> {
  const r = await q().query(`DELETE FROM assessment_sheets WHERE program_id = $1 AND is_test = true RETURNING id`, [programId]);
  await q().query(`DELETE FROM assessment_queue WHERE program_id = $1 AND is_test = true`, [programId]);
  return r.length;
}

/** Kelengkapan tiap minggu: murid ber-buku vs sudah bernilai (hasil resmi) vs masih di antrean. Dipakai untuk membuka unduhan Excel. */
export async function weekProgress(programId: number): Promise<Map<number, { total: number; done: number; pending: number; complete: boolean }>> {
  const [tot, done, pend] = await Promise.all([
    q().query(`SELECT a.week, count(*)::int AS n FROM allocations a WHERE a.program_id = $1 GROUP BY a.week`, [programId]),
    q().query(`SELECT week, count(*)::int AS n FROM assessment_results WHERE program_id = $1 GROUP BY week`, [programId]),
    q().query(`SELECT week, count(*)::int AS n FROM assessment_queue WHERE program_id = $1 AND is_test = false AND status IN ('menunggu', 'diproses') GROUP BY week`, [programId]),
  ]);
  const d = new Map(done.map((x) => [x.week as number, x.n as number]));
  const p = new Map(pend.map((x) => [x.week as number, x.n as number]));
  const out = new Map<number, { total: number; done: number; pending: number; complete: boolean }>();
  for (const x of tot) {
    const w = x.week as number;
    const total = x.n as number;
    const dn = Math.min(d.get(w) ?? 0, total);
    const pe = p.get(w) ?? 0;
    out.set(w, { total, done: dn, pending: pe, complete: total > 0 && dn >= total && pe === 0 });
  }
  return out;
}
