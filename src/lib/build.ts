import { sql } from "./db";
import { allBooks, programCells, readHistory } from "./q";
import { generate, type Level } from "./engine";
import type { Program, RosterRow } from "./types";
import type { Result } from "./result";

/**
 * Menyimpan perubahan program + alokasi dalam SATU transaksi.
 * - fromWeek: minggu pertama yang dibuat ulang (minggu sebelumnya dikunci)
 * - roster: daftar murid program (null = pakai yang tersimpan); replaceRoster=true menimpa program_students
 * Bila alokasi tidak layak, tidak ada yang berubah dan pesan error dikembalikan.
 */
export async function persistProgram(prog: Program, roster: RosterRow[], fromWeek: number, replaceRoster: boolean): Promise<Result & { crossLevel?: number }> {
  const s = sql();
  const ids = roster.map((r) => r.id);

  if (!roster.length) {
    await s`UPDATE programs SET months = ${prog.months}, weeks = ${prog.weeks}, start_date = ${prog.start_date}::date, mode = ${prog.mode},
            continues_from = ${prog.continues_from}, week_offset = ${prog.week_offset}, copies = ${prog.copies} WHERE id = ${prog.id}`;
    return { ok: true, message: "Program disimpan. Menunggu data murid." };
  }

  const [books, existing, history] = await Promise.all([allBooks(), programCells(prog.id), readHistory(prog.id, prog.institution_id)]);
  const inRoster = new Set(ids);
  const locked = fromWeek > 1 ? existing.filter((c) => c.week < fromWeek && inRoster.has(c.student_id)) : [];

  const gen = generate({
    students: roster.map((r) => ({ id: r.id, nis: r.nis, name: r.name, level: r.level as Level })),
    books,
    copies: prog.copies,
    weekFrom: fromWeek,
    weekTo: prog.weeks,
    weekOffset: prog.week_offset,
    locked,
    hardRead: history.hard,
    softRead: history.soft,
  });

  if (gen.errors.length) {
    await s`UPDATE programs SET alloc_error = ${gen.errors[0]} WHERE id = ${prog.id}`;
    return { ok: false, error: "Alokasi tidak dapat dibuat. Tidak ada data yang diubah.", details: gen.errors };
  }

  const stmts = [
    s`UPDATE programs SET months = ${prog.months}, weeks = ${prog.weeks}, start_date = ${prog.start_date}::date, mode = ${prog.mode},
        continues_from = ${prog.continues_from}, week_offset = ${prog.week_offset}, copies = ${prog.copies},
        status = 'siap', alloc_error = NULL WHERE id = ${prog.id}`,
    s`DELETE FROM allocations WHERE program_id = ${prog.id} AND (week >= ${fromWeek} OR week > ${prog.weeks})`,
    s`DELETE FROM allocations WHERE program_id = ${prog.id} AND NOT (student_id = ANY(${ids}::int[]))`,
  ];
  if (replaceRoster) {
    stmts.push(
      s`DELETE FROM program_students WHERE program_id = ${prog.id}`,
      s`INSERT INTO program_students (program_id, student_id, level)
        SELECT ${prog.id}::int, * FROM unnest(${ids}::int[], ${roster.map((r) => r.level)}::text[])`,
    );
  }
  if (gen.cells.length) {
    stmts.push(
      s`INSERT INTO allocations (program_id, student_id, week, book_id)
        SELECT ${prog.id}::int, * FROM unnest(${gen.cells.map((c) => c.student_id)}::int[], ${gen.cells.map((c) => c.week)}::int[], ${gen.cells.map((c) => c.book_id)}::int[])`,
    );
  }
  await s.transaction(stmts);
  return {
    ok: true,
    crossLevel: gen.crossLevel,
    message: `Alokasi dibuat untuk ${roster.length} murid (${gen.cells.length} penugasan baru).`,
    warnings: [
      gen.peakShare > prog.copies ? `Murid lebih banyak dari judul: pada minggu yang sama satu judul dibaca hingga ${gen.peakShare} murid (dibagi rata). Seorang murid tidak pernah mendapat judul yang sama dua kali.` : "",
      gen.crossLevel ? `${gen.crossLevel} penugasan memakai buku level lain karena judul di level murid sudah habis.` : "",
    ].filter(Boolean),
  };
}

import { releasedWeeks } from "./schedule";

/** Menerapkan daftar murid baru ke program: program baru -> dari minggu 1; program berjalan -> hanya minggu yang belum rilis. */
export async function applyRoster(prog: Program, roster: RosterRow[]): Promise<Result & { crossLevel?: number }> {
  let from = 1;
  if (prog.status === "siap") {
    const rel = releasedWeeks(prog.start_date, prog.weeks, Date.now());
    if (rel > 0) from = rel + 1;
  }
  return persistProgram(prog, roster, from, true);
}
