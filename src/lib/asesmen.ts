import { sql } from "./db";
import { getAssessSettings, getProgram } from "./q";
import { assessWindow } from "./schedule";
import type { Program, User } from "./types";

type Row = Record<string, any>;
const q = () => sql();

/** Program yang boleh diakses pengguna (admin: semua; guru: institusinya) dan sudah punya alokasi. */
export async function programFor(user: User, id: number): Promise<{ p: Program } | { error: string; status: number }> {
  const p = await getProgram(id);
  if (!p) return { error: "Program tidak ditemukan", status: 404 };
  if (user.role === "guru" && user.institution_id !== p.institution_id) return { error: "Forbidden", status: 403 };
  if (p.status !== "siap") return { error: "Program belum punya alokasi", status: 409 };
  return { p };
}

export async function windowOf(p: Program, week: number) {
  const s = await getAssessSettings();
  return { ...assessWindow(p.start_date, week, s.printDay, s.deadlineHours), settings: s };
}

export type SheetRow = {
  student_id: number; nis: string; name: string; level: string;
  book_id: number | null; title: string | null; has_tpl: boolean;
  score: number | null; status: string | null;
};

/** Murid + buku minggu itu + ada/tidaknya template + nilai (bila sudah ada). */
export async function weekRows(programId: number, week: number): Promise<SheetRow[]> {
  const r = (await q().query(
    `SELECT ps.student_id, s.nis, s.name, ps.level, a.book_id, b.title,
            (t.book_id IS NOT NULL) AS has_tpl, r.score::float AS score, r.status
       FROM program_students ps
       JOIN students s ON s.id = ps.student_id
       LEFT JOIN allocations a ON a.program_id = ps.program_id AND a.student_id = ps.student_id AND a.week = $2
       LEFT JOIN books b ON b.id = a.book_id
       LEFT JOIN assessment_templates t ON t.book_id = a.book_id
       LEFT JOIN assessment_results r ON r.program_id = ps.program_id AND r.student_id = ps.student_id AND r.week = $2
      WHERE ps.program_id = $1`,
    [programId, week],
  )) as Row[];
  return (r as SheetRow[]).sort((a, b) => a.nis.localeCompare(b.nis, "id", { numeric: true }) || a.student_id - b.student_id);
}

export async function templateOf(bookId: number): Promise<{ pdf_b64: string; rubric: string | null } | null> {
  const r = await q().query(`SELECT pdf_b64, rubric FROM assessment_templates WHERE book_id = $1`, [bookId]);
  return r[0] ? { pdf_b64: r[0].pdf_b64 as string, rubric: (r[0].rubric as string | null) ?? null } : null;
}

export async function templateB64s(bookIds: number[]): Promise<Map<number, string>> {
  if (!bookIds.length) return new Map();
  const r = await q().query(`SELECT book_id, pdf_b64 FROM assessment_templates WHERE book_id = ANY($1::int[])`, [bookIds]);
  return new Map(r.map((x) => [x.book_id as number, x.pdf_b64 as string]));
}

export async function logDownload(programId: number, week: number, userId: number, kind: string, items: number): Promise<void> {
  await q().query(`INSERT INTO assessment_downloads (program_id, week, user_id, kind, items) VALUES ($1, $2, $3, $4, $5)`, [programId, week, userId, kind, items]);
}

export async function saveResult(programId: number, studentId: number, week: number, score: number, status: "dinilai" | "perlu_cek" | "manual", detail: unknown, userId: number): Promise<void> {
  await q().query(
    `INSERT INTO assessment_results (program_id, student_id, week, score, status, detail, uploaded_by, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, now())
     ON CONFLICT (program_id, student_id, week)
     DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status, detail = EXCLUDED.detail, uploaded_by = EXCLUDED.uploaded_by, uploaded_at = now()`,
    [programId, studentId, week, score, status, detail == null ? null : JSON.stringify(detail), userId],
  );
}

export async function weekSummary(programId: number): Promise<Map<number, number>> {
  const r = await q().query(`SELECT week, count(*)::int AS n FROM assessment_results WHERE program_id = $1 GROUP BY week`, [programId]);
  return new Map(r.map((x) => [x.week as number, x.n as number]));
}

export async function recentDownloads(programId: number): Promise<{ week: number; kind: string; items: number; at: string; who: string | null }[]> {
  const r = await q().query(
    `SELECT d.week, d.kind, d.items, d.downloaded_at::text AS at, u.name AS who
       FROM assessment_downloads d LEFT JOIN users u ON u.id = d.user_id
      WHERE d.program_id = $1 ORDER BY d.downloaded_at DESC LIMIT 60`,
    [programId],
  );
  return r as { week: number; kind: string; items: number; at: string; who: string | null }[];
}

/** Semua nilai program: kunci "studentId:week" -> nilai. */
export async function allScores(programId: number): Promise<Map<string, number>> {
  const r = await q().query(`SELECT student_id, week, score::float AS score FROM assessment_results WHERE program_id = $1`, [programId]);
  return new Map(r.map((x) => [`${x.student_id}:${x.week}`, x.score as number]));
}

export async function templateStatus(): Promise<{ id: number; title: string; has: boolean }[]> {
  const r = await q().query(`SELECT b.id, b.title, (t.book_id IS NOT NULL) AS has FROM books b LEFT JOIN assessment_templates t ON t.book_id = b.id ORDER BY b.title`);
  return r as { id: number; title: string; has: boolean }[];
}
