// Mesin alokasi buku (murni, tanpa dependensi).
//
// Aturan:
//  1. Murid tidak pernah menerima judul yang sama dua kali dalam satu program (termasuk lanjutan).
//  2. Satu judul dibaca maksimal `copies` murid pada minggu yang sama.
//  3. Preferensi judul: level sendiri dulu (rotasi seperti Excel: kelompok g, minggu w -> judul (g+w-1) mod n).
//     Jika judul level sendiri habis, ambil level di atasnya, lalu level lain.
//     Pemula: Pemula > Madya > Mahir. Madya: Madya > Mahir > Pemula. Mahir: Mahir > Madya > Pemula.
//  4. Tiap minggu dicocokkan dengan bipartite matching (augmenting path) supaya kapasitas terpakai optimal.
//  5. Judul yang pernah dibaca di program sebelumnya (soft) dipakai paling akhir dalam level yang sama.

export type Level = "Pemula" | "Madya" | "Mahir";
export const LEVELS: Level[] = ["Pemula", "Madya", "Mahir"];
export const TIERS: Record<Level, Level[]> = {
  Pemula: ["Pemula", "Madya", "Mahir"],
  Madya: ["Madya", "Mahir", "Pemula"],
  Mahir: ["Mahir", "Madya", "Pemula"],
};

export type Book = { id: number; title: string; level: Level };
export type Stu = { id: number; nis: string; name: string; level: Level };
export type Cell = { student_id: number; week: number; book_id: number };

export type GenInput = {
  students: Stu[];
  books: Book[];
  copies: number;
  weekFrom: number; // minggu pertama yang dibuat (1-based, dalam program)
  weekTo: number;
  weekOffset: number; // untuk program lanjutan: nomor minggu global = offset + minggu
  locked?: Cell[]; // sel yang sudah tetap (minggu < weekFrom)
  hardRead?: Map<number, Set<number>>; // judul terlarang (program yang dilanjutkan)
  softRead?: Map<number, Set<number>>; // judul dari program lama, dihindari bila bisa
};
export type GenResult = { cells: Cell[]; errors: string[]; crossLevel: number };

export const byNis = (a: Stu, b: Stu) => a.nis.localeCompare(b.nis, "id", { numeric: true }) || a.id - b.id;

export function catalogCounts(books: Book[]): Record<Level, number> {
  const c: Record<Level, number> = { Pemula: 0, Madya: 0, Mahir: 0 };
  for (const b of books) c[b.level]++;
  return c;
}

export function generate(inp: GenInput): GenResult {
  const { students, books, copies, weekFrom, weekTo, weekOffset } = inp;
  const errors: string[] = [];
  if (!students.length) return { cells: [], errors: ["Belum ada murid."], crossLevel: 0 };
  if (students.length > books.length * copies) {
    return {
      cells: [],
      errors: [`Murid (${students.length}) melebihi kapasitas katalog: ${books.length} judul × ${copies} eksemplar = ${books.length * copies} per minggu.`],
      crossLevel: 0,
    };
  }

  const sorted = [...students].sort(byNis);
  const titles: Record<Level, Book[]> = { Pemula: [], Madya: [], Mahir: [] };
  for (const b of [...books].sort((a, b) => a.id - b.id)) titles[b.level].push(b);
  const levelOf = new Map(books.map((b) => [b.id, b.level]));

  const rank = new Map<number, number>();
  const seen: Record<Level, number> = { Pemula: 0, Madya: 0, Mahir: 0 };
  for (const s of sorted) rank.set(s.id, seen[s.level]++);

  const read = new Map<number, Set<number>>();
  for (const s of sorted) read.set(s.id, new Set(inp.hardRead?.get(s.id) ?? []));
  for (const c of inp.locked ?? []) read.get(c.student_id)?.add(c.book_id);

  const cells: Cell[] = [];
  let cross = 0;

  for (let w = weekFrom; w <= weekTo; w++) {
    const gw = weekOffset + w;
    const cand = new Map<number, number[]>();
    for (const s of sorted) {
      const g = Math.floor(rank.get(s.id)! / copies);
      const have = read.get(s.id)!;
      const soft = inp.softRead?.get(s.id);
      const list: number[] = [];
      for (const lv of TIERS[s.level]) {
        const t = titles[lv];
        const n = t.length;
        if (!n) continue;
        const start = (g + gw - 1) % n;
        const fresh: number[] = [];
        const old: number[] = [];
        for (let i = 0; i < n; i++) {
          const b = t[(start + i) % n];
          if (have.has(b.id)) continue;
          (soft?.has(b.id) ? old : fresh).push(b.id);
        }
        list.push(...fresh, ...old);
      }
      cand.set(s.id, list);
    }

    const occ = new Map<number, number[]>();
    const assigned = new Map<number, number>();
    const tryAssign = (sid: number, visited: Set<number>): boolean => {
      for (const b of cand.get(sid)!) {
        if (visited.has(b)) continue;
        visited.add(b);
        const list = occ.get(b) ?? [];
        if (list.length < copies) {
          occ.set(b, [...list, sid]);
          assigned.set(sid, b);
          return true;
        }
        for (const other of list) {
          if (tryAssign(other, visited)) {
            occ.set(b, [...(occ.get(b) ?? []).filter((x) => x !== other), sid]);
            assigned.set(sid, b);
            return true;
          }
        }
      }
      return false;
    };

    const failed: Stu[] = [];
    for (const s of sorted) if (!tryAssign(s.id, new Set())) failed.push(s);
    if (failed.length) {
      errors.push(
        `Minggu ${w}: ${failed.length} murid tidak mendapat judul baru (mis. ${failed[0].name}). Katalog atau eksemplar tidak cukup untuk durasi ini.`,
      );
      break;
    }
    for (const s of sorted) {
      const b = assigned.get(s.id)!;
      read.get(s.id)!.add(b);
      cells.push({ student_id: s.id, week: w, book_id: b });
      if (levelOf.get(b) !== s.level) cross++;
    }
  }
  return errors.length ? { cells: [], errors, crossLevel: 0 } : { cells, errors, crossLevel: cross };
}

/** Pemeriksaan konsistensi (untuk tes dan audit). */
export function audit(cells: Cell[], copies: number): string[] {
  const issues: string[] = [];
  const per = new Map<string, number>();
  const mine = new Set<string>();
  for (const c of cells) {
    const k = `${c.book_id}:${c.week}`;
    per.set(k, (per.get(k) ?? 0) + 1);
    const r = `${c.student_id}:${c.book_id}`;
    if (mine.has(r)) issues.push(`murid ${c.student_id} mengulang buku ${c.book_id}`);
    mine.add(r);
  }
  for (const [k, n] of per) if (n > copies) issues.push(`judul:minggu ${k} dipakai ${n} > ${copies}`);
  return issues;
}
