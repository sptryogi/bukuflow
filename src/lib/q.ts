import { sql } from "./db";
import type { Book, Level } from "./engine";
import type { Program, RosterRow, User } from "./types";

type Row = Record<string, any>;
const q = () => sql();

const USER_COLS = `id, name, email, role, status, institution_id, school_name, approved_via, created_at::text AS created_at`;
const PROG_COLS = `id, institution_id, months, weeks, to_char(start_date, 'YYYY-MM-DD') AS start_date, mode, continues_from, week_offset, status, copies, alloc_error`;

export async function userById(id: number): Promise<User | null> {
  const r = await q().query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
  return (r[0] as User) ?? null;
}

export async function userAuthByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const r = await q().query(`SELECT ${USER_COLS}, password_hash FROM users WHERE lower(email) = $1`, [email]);
  return (r[0] as User & { password_hash: string }) ?? null;
}

export async function listGurus(): Promise<(User & { institution_name: string | null })[]> {
  const r = await q().query(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.institution_id, u.school_name, u.approved_via, u.created_at::text AS created_at,
            i.name AS institution_name
     FROM users u LEFT JOIN institutions i ON i.id = u.institution_id
     WHERE u.role = 'guru'
     ORDER BY (u.status = 'aktif'), u.created_at DESC`,
  );
  return r as (User & { institution_name: string | null })[];
}

export async function listInstitutionOptions(): Promise<{ id: number; name: string }[]> {
  return (await q().query(`SELECT id, name FROM institutions ORDER BY name`)) as { id: number; name: string }[];
}

export async function listInstitutionsSummary(): Promise<Row[]> {
  return await q().query(
    `SELECT i.id, i.name, i.created_at::text AS created_at,
            (SELECT count(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'guru') AS guru_total,
            (SELECT count(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'guru' AND u.status = 'aktif') AS guru_aktif,
            (SELECT count(*)::int FROM programs p WHERE p.institution_id = i.id) AS program_total
     FROM institutions i ORDER BY i.name`,
  );
}

export async function getInstitution(id: number): Promise<{ id: number; name: string } | null> {
  const r = await q().query(`SELECT id, name FROM institutions WHERE id = $1`, [id]);
  return (r[0] as { id: number; name: string }) ?? null;
}

export async function institutionGurus(id: number): Promise<(User & { institution_name: string | null })[]> {
  const r = await q().query(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.institution_id, u.school_name, u.approved_via, u.created_at::text AS created_at, i.name AS institution_name
     FROM users u LEFT JOIN institutions i ON i.id = u.institution_id
     WHERE u.role = 'guru' AND u.institution_id = $1 ORDER BY u.created_at`,
    [id],
  );
  return r as (User & { institution_name: string | null })[];
}

export async function institutionPrograms(id: number): Promise<(Program & { students: number })[]> {
  const r = await q().query(
    `SELECT ${PROG_COLS}, (SELECT count(*)::int FROM program_students ps WHERE ps.program_id = programs.id) AS students
     FROM programs WHERE institution_id = $1 ORDER BY start_date DESC, id DESC`,
    [id],
  );
  return r as (Program & { students: number })[];
}

export async function allProgramsBrief(): Promise<Row[]> {
  return await q().query(`SELECT id, institution_id, weeks, to_char(start_date,'YYYY-MM-DD') AS start_date, status FROM programs`);
}

export async function getProgram(id: number): Promise<Program | null> {
  const r = await q().query(`SELECT ${PROG_COLS} FROM programs WHERE id = $1`, [id]);
  return (r[0] as Program) ?? null;
}

export async function programRoster(programId: number): Promise<RosterRow[]> {
  const r = await q().query(
    `SELECT s.id, s.nis, s.name, ps.level FROM program_students ps JOIN students s ON s.id = ps.student_id WHERE ps.program_id = $1`,
    [programId],
  );
  return (r as RosterRow[]).sort((a, b) => a.nis.localeCompare(b.nis, "id", { numeric: true }) || a.id - b.id);
}

export async function programCells(programId: number, maxWeek?: number): Promise<{ student_id: number; week: number; book_id: number }[]> {
  const r = await q().query(
    `SELECT student_id, week, book_id FROM allocations WHERE program_id = $1 AND ($2::int IS NULL OR week <= $2) ORDER BY student_id, week`,
    [programId, maxWeek ?? null],
  );
  return r as { student_id: number; week: number; book_id: number }[];
}

export async function allBooks(): Promise<Book[]> {
  return (await q().query(`SELECT id, title, level FROM books ORDER BY id`)) as Book[];
}

/** Riwayat baca: hard = rantai program yang dilanjutkan; soft = program lain di institusi yang sama. */
export async function readHistory(programId: number, institutionId: number): Promise<{ hard: Map<number, Set<number>>; soft: Map<number, Set<number>> }> {
  const hardRows = await q().query(
    `WITH RECURSIVE ch AS (
       SELECT id, continues_from FROM programs WHERE id = $1
       UNION ALL
       SELECT p.id, p.continues_from FROM programs p JOIN ch ON p.id = ch.continues_from
     )
     SELECT student_id, book_id FROM allocations WHERE program_id IN (SELECT id FROM ch WHERE id <> $1)`,
    [programId],
  );
  const softRows = await q().query(
    `SELECT a.student_id, a.book_id FROM allocations a JOIN programs p ON p.id = a.program_id
     WHERE p.institution_id = $1 AND a.program_id <> $2`,
    [institutionId, programId],
  );
  const toMap = (rows: Row[]) => {
    const m = new Map<number, Set<number>>();
    for (const r of rows) {
      if (!m.has(r.student_id)) m.set(r.student_id, new Set());
      m.get(r.student_id)!.add(r.book_id);
    }
    return m;
  };
  return { hard: toMap(hardRows), soft: toMap(softRows) };
}

export const normName = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Cari institusi berdasarkan nama (dinormalisasi) atau buat baru. */
export async function findOrCreateInstitution(name: string): Promise<number> {
  const norm = normName(name);
  const found = await q().query(`SELECT id FROM institutions WHERE name_norm = $1 ORDER BY id LIMIT 1`, [norm]);
  if (found[0]) return found[0].id as number;
  const ins = await q().query(`INSERT INTO institutions (name, name_norm) VALUES ($1, $2) RETURNING id`, [name.trim(), norm]);
  return ins[0].id as number;
}

/** Pembatas laju. Mengembalikan true bila masih diizinkan. */
export async function throttle(key: string, max: number, windowSec: number): Promise<boolean> {
  const r = await q().query(
    `INSERT INTO throttle (key, count, window_start) VALUES ($1, 1, now())
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN throttle.window_start < now() - make_interval(secs => $2) THEN 1 ELSE throttle.count + 1 END,
       window_start = CASE WHEN throttle.window_start < now() - make_interval(secs => $2) THEN now() ELSE throttle.window_start END
     RETURNING count`,
    [key, windowSec],
  );
  return Number(r[0].count) <= max;
}

export type { Level };
