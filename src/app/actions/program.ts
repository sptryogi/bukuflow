"use server";

import { sql } from "@/lib/db";
import { actor } from "@/lib/session";
import { getMaxStudents, getProgram, programRoster } from "@/lib/q";
import { applyRoster } from "@/lib/build";
import { parseRoster, type ParsedRow } from "@/lib/excel";
import { fail, refresh, run } from "@/lib/act";
import type { Preview, Result } from "@/lib/result";
import type { Level } from "@/lib/engine";
import type { Program, RosterRow, User } from "@/lib/types";

async function access(u: User, programId: number): Promise<Program> {
  const p = await getProgram(programId);
  if (!p) throw new Error("Program tidak ditemukan.");
  if (u.role === "guru" && u.institution_id !== p.institution_id) throw new Error("Anda tidak memiliki akses ke program ini.");
  return p;
}

async function readFile(fd: FormData): Promise<{ rows: ParsedRow[]; errors: string[] } | string> {
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return "Pilih file Excel (.xlsx) terlebih dahulu.";
  if (f.size > 3 * 1024 * 1024) return "Ukuran file maksimal 3 MB.";
  if (!/\.xlsx$/i.test(f.name)) return "Gunakan file .xlsx (template yang diunduh dari halaman ini).";
  return parseRoster(Buffer.from(await f.arrayBuffer()), await getMaxStudents());
}

/** Langkah 1: baca dan validasi file, tampilkan pratinjau. Tidak ada yang disimpan. */
export async function previewRoster(fd: FormData): Promise<Preview> {
  try {
    const u = await actor();
    await access(u, Number(fd.get("program_id")));
    const parsed = await readFile(fd);
    if (typeof parsed === "string") return { ok: false, error: parsed };
    const counts = { Pemula: 0, Madya: 0, Mahir: 0 };
    for (const r of parsed.rows) counts[r.level]++;
    return {
      ok: true,
      total: parsed.rows.length,
      counts,
      sample: parsed.rows.slice(0, 30).map((r) => ({ nis: r.nis, name: r.name, level: r.level })),
      errors: parsed.errors,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Terjadi kesalahan." };
  }
}

/** Langkah 2: simpan murid dan buat alokasi. */
export async function commitRoster(fd: FormData): Promise<Result> {
  return run(async (u) => {
    const p = await access(u, Number(fd.get("program_id")));
    const parsed = await readFile(fd);
    if (typeof parsed === "string") return fail(parsed);
    if (parsed.errors.length) return fail("File masih memiliki kesalahan. Perbaiki lalu unggah ulang.", parsed.errors);

    const rows = parsed.rows;
    const saved = await sql().query(
      `INSERT INTO students (institution_id, nis, name, level)
       SELECT $1::int, * FROM unnest($2::text[], $3::text[], $4::text[])
       ON CONFLICT (institution_id, nis) DO UPDATE SET name = EXCLUDED.name, level = EXCLUDED.level
       RETURNING id, nis`,
      [p.institution_id, rows.map((r) => r.nis), rows.map((r) => r.name), rows.map((r) => r.level)],
    );
    const idOf = new Map<string, number>(saved.map((r) => [r.nis as string, r.id as number]));
    const roster: RosterRow[] = rows.map((r) => ({ id: idOf.get(r.nis)!, nis: r.nis, name: r.name, level: r.level as Level }));
    const res = await applyRoster(p, roster);
    if (res.ok) refresh();
    return res;
  });
}

/** Pakai daftar murid dari program lain di institusi yang sama. */
export async function copyRoster(programId: number, fromId: number): Promise<Result> {
  return run(async (u) => {
    const p = await access(u, programId);
    const from = await access(u, fromId);
    if (from.institution_id !== p.institution_id) return fail("Program sumber harus dari institusi yang sama.");
    const roster = await programRoster(from.id);
    if (!roster.length) return fail("Program sumber belum punya daftar murid.");
    const res = await applyRoster(p, roster);
    if (res.ok) refresh();
    return res;
  });
}

