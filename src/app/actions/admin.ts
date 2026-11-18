"use server";

import { sql } from "@/lib/db";
import { getInstitution, getProgram, findOrCreateInstitution, normName, programRoster, userById } from "@/lib/q";
import { persistProgram } from "@/lib/build";
import { LEVELS, type Level } from "@/lib/engine";
import { addDays, firstMondayOfMonth, releasedWeeks, WEEKS_PER_MONTH } from "@/lib/schedule";
import { fail, ok, refresh, run, toInt } from "@/lib/act";
import type { Program } from "@/lib/types";
import type { Result } from "@/lib/result";

const asAdmin = (fn: Parameters<typeof run>[0]) => run(fn, "admin");
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const normLevel = (v: unknown): Level | null => LEVELS.find((l) => l.toLowerCase() === String(v ?? "").trim().toLowerCase()) ?? null;

/* ---------- guru ---------- */

export async function approveUser(userId: number): Promise<Result> {
  return asAdmin(async () => {
    const t = await userById(userId);
    if (!t || t.role !== "guru") return fail("Pengguna tidak ditemukan.");
    const inst = t.institution_id ?? (t.school_name ? await findOrCreateInstitution(t.school_name) : null);
    await sql().query(
      `UPDATE users SET status = 'aktif', approved_via = 'admin', approved_at = now(), institution_id = $2 WHERE id = $1 AND status <> 'aktif'`,
      [userId, inst],
    );
    refresh();
    return ok(`${t.name} disetujui.`);
  });
}

export async function rejectUser(userId: number): Promise<Result> {
  return asAdmin(async () => {
    const t = await userById(userId);
    if (!t || t.role !== "guru") return fail("Pengguna tidak ditemukan.");
    await sql().query(`UPDATE users SET status = 'ditolak' WHERE id = $1`, [userId]);
    refresh();
    return ok(`${t.name} ditolak / dinonaktifkan.`);
  });
}

export async function setUserInstitution(userId: number, institutionId: number): Promise<Result> {
  return asAdmin(async () => {
    if (!(await getInstitution(institutionId))) return fail("Institusi tidak ditemukan.");
    await sql().query(`UPDATE users SET institution_id = $2 WHERE id = $1 AND role = 'guru'`, [userId, institutionId]);
    refresh();
    return ok("Institusi guru dipindahkan.");
  });
}

/* ---------- institusi ---------- */

export async function saveInstitution(fd: FormData): Promise<Result> {
  return asAdmin(async () => {
    const id = toInt(fd.get("id"), 1, 2_000_000_000);
    const name = String(fd.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 150) return fail("Nama institusi wajib diisi (2-150 karakter).");
    if (id) await sql().query(`UPDATE institutions SET name = $2, name_norm = $3 WHERE id = $1`, [id, name, normName(name)]);
    else await findOrCreateInstitution(name);
    refresh();
    return ok("Institusi disimpan.");
  });
}

export async function deleteInstitution(id: number): Promise<Result> {
  return asAdmin(async () => {
    const g = await sql().query(`SELECT count(*)::int AS n FROM users WHERE institution_id = $1`, [id]);
    if (g[0].n > 0) return fail("Masih ada guru di institusi ini. Pindahkan atau tolak mereka dulu.");
    await sql().query(`DELETE FROM institutions WHERE id = $1`, [id]);
    refresh();
    return ok("Institusi dihapus beserta program dan data muridnya.");
  });
}

/* ---------- buku ---------- */

export async function saveBook(fd: FormData): Promise<Result> {
  return asAdmin(async () => {
    const id = toInt(fd.get("id"), 1, 2_000_000_000);
    const title = String(fd.get("title") ?? "").trim();
    const level = normLevel(fd.get("level"));
    if (!title || title.length > 200) return fail("Judul wajib diisi (maks. 200 karakter).");
    if (!level) return fail("Level tidak valid.");
    if (id) {
      const used = await sql().query(`SELECT 1 FROM allocations a JOIN books b ON b.id = a.book_id WHERE a.book_id = $1 AND b.level <> $2 LIMIT 1`, [id, level]);
      if (used.length) return fail("Level buku ini tidak bisa diubah karena sudah dipakai di alokasi.");
      await sql().query(`UPDATE books SET title = $2, level = $3 WHERE id = $1`, [id, title, level]);
    } else {
      await sql().query(`INSERT INTO books (title, level) VALUES ($1, $2)`, [title, level]);
    }
    refresh();
    return ok("Buku disimpan.");
  });
}

export async function deleteBook(id: number): Promise<Result> {
  return asAdmin(async () => {
    await sql().query(`DELETE FROM books WHERE id = $1`, [id]);
    refresh();
    return ok("Buku dihapus.");
  });
}

export async function importBooks(fd: FormData): Promise<Result> {
  return asAdmin(async () => {
    const defLevel = normLevel(fd.get("default_level"));
    const lines = String(fd.get("text") ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return fail("Tempelkan minimal satu baris.");
    if (lines.length > 1000) return fail("Maksimal 1000 baris per impor.");
    const titles: string[] = [];
    const levels: string[] = [];
    const errors: string[] = [];
    lines.forEach((line, i) => {
      const p = line.split(/\t|;/).map((x) => x.trim());
      if (i === 0 && /^judul/i.test(p[0]) && p[1] && !normLevel(p[1])) return;
      const level = p[1] ? normLevel(p[1]) : defLevel;
      if (!p[0] || p[0].length > 200) return errors.push(`Baris ${i + 1}: judul kosong/terlalu panjang.`);
      if (!level) return errors.push(`Baris ${i + 1} (${p[0]}): level tidak dikenal.`);
      titles.push(p[0]);
      levels.push(level);
    });
    if (!titles.length) return fail("Tidak ada baris valid.", errors);
    const r = await sql().query(
      `INSERT INTO books (title, level) SELECT * FROM unnest($1::text[], $2::text[]) ON CONFLICT (title) DO NOTHING RETURNING id`,
      [titles, levels],
    );
    refresh();
    const skipped = titles.length - r.length;
    return ok(`${r.length} buku ditambahkan${skipped ? `, ${skipped} dilewati (judul sudah ada)` : ""}.`, errors);
  });
}

/* ---------- program ---------- */

export async function createProgram(fd: FormData): Promise<Result> {
  return asAdmin(async () => {
    const instId = toInt(fd.get("institution_id"), 1, 2_000_000_000);
    const months = toInt(fd.get("months"), 3, 12);
    const copies = toInt(fd.get("copies"), 1, 20) ?? 2;
    const mode = String(fd.get("mode"));
    if (!instId || !(await getInstitution(instId))) return fail("Institusi tidak ditemukan.");
    if (!months || ![3, 6, 12].includes(months)) return fail("Durasi harus 3, 6, atau 12 bulan.");

    let start: string, offset = 0, cont: number | null = null;
    if (mode === "lanjutan") {
      const prev = await getProgram(toInt(fd.get("continue_id"), 1, 2_000_000_000) ?? 0);
      if (!prev || prev.institution_id !== instId) return fail("Pilih program sebelumnya yang akan dilanjutkan.");
      if (prev.status !== "siap") return fail("Program sebelumnya belum punya alokasi, belum bisa dilanjutkan.");
      start = addDays(prev.start_date, prev.weeks * 7);
      offset = prev.week_offset + prev.weeks;
      cont = prev.id;
    } else {
      const month = String(fd.get("month") ?? "");
      if (!MONTH_RE.test(month)) return fail("Pilih bulan mulai program.");
      start = firstMondayOfMonth(month);
    }
    await sql().query(
      `INSERT INTO programs (institution_id, months, weeks, start_date, mode, continues_from, week_offset, copies)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8)`,
      [instId, months, months * WEEKS_PER_MONTH, start, mode === "lanjutan" ? "lanjutan" : "awal_bulan", cont, offset, copies],
    );
    refresh();
    return ok("Program dibuat. Statusnya menunggu data murid: unggah template atau minta guru mengunggahnya.");
  });
}

export async function updateProgram(fd: FormData): Promise<Result> {
  return asAdmin(async () => {
    const p = await getProgram(toInt(fd.get("id"), 1, 2_000_000_000) ?? 0);
    if (!p) return fail("Program tidak ditemukan.");
    const months = toInt(fd.get("months"), 3, 12);
    if (!months || ![3, 6, 12].includes(months)) return fail("Durasi harus 3, 6, atau 12 bulan.");
    const mode = String(fd.get("mode"));
    const roster = await programRoster(p.id);
    const next: Program = { ...p, months, weeks: months * WEEKS_PER_MONTH };
    let from = 1;

    if (mode === "awal_bulan") {
      const month = String(fd.get("month") ?? "");
      if (!MONTH_RE.test(month)) return fail("Pilih bulan mulai program.");
      next.start_date = firstMondayOfMonth(month);
      next.mode = "awal_bulan";
      next.continues_from = null;
      next.week_offset = 0;
    } else if (p.status === "siap") {
      const rel = releasedWeeks(p.start_date, p.weeks, Date.now());
      if (next.weeks < rel) return fail(`Program sudah berjalan ${rel} minggu. Durasi baru minimal ${Math.ceil(rel / WEEKS_PER_MONTH)} bulan.`);
      from = rel > 0 ? rel + 1 : 1;
    }
    const r = await persistProgram(next, roster, from, false);
    if (r.ok) refresh();
    return r;
  });
}

export async function deleteProgram(id: number): Promise<Result> {
  return asAdmin(async () => {
    await sql().query(`DELETE FROM programs WHERE id = $1`, [id]);
    refresh();
    return ok("Program dihapus.");
  });
}
