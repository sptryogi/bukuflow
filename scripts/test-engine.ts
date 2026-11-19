// Jalankan: npm test   (Node >= 22.6)
import { readFileSync } from "node:fs";
import { generate, audit, TIERS, LEVELS } from "../src/lib/engine.ts";
import type { Book, Stu, Level } from "../src/lib/engine.ts";
import { firstMondayOfMonth, releasedWeeks, releaseMs, addDays, phase, nextMonthStr, nextMonday, todayWib, resolveStart, dayName } from "../src/lib/schedule.ts";

const seed = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url), "utf8"));
const books: Book[] = seed.books.map((b: any, i: number) => ({ id: i + 1, title: b.title, level: b.level as Level }));
const titleOf = new Map(books.map((b) => [b.id, b.title]));
const mk = (p: number, m: number, h: number): Stu[] => {
  const out: Stu[] = [];
  let n = 0;
  for (const [lv, c] of [["Pemula", p], ["Madya", m], ["Mahir", h]] as [Level, number][]) for (let i = 0; i < c; i++) { n++; out.push({ id: n, nis: String(1000 + n), name: `Anak ${n}`, level: lv }); }
  return out;
};
let fails = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? "  ✓ " : "  ✗ ") + msg); if (!c) fails++; };
const run = (students: Stu[], weeks: number, extra: object = {}) =>
  generate({ students, books, copies: 2, weekFrom: 1, weekTo: weeks, weekOffset: 0, ...extra });
const lvl = new Map(books.map((b) => [b.id, b.level]));

console.log("3 bulan (12 minggu), 60 murid: identik dengan rotasi Excel");
{
  const st = mk(20, 25, 15);
  const r = run(st, 12);
  ok(r.errors.length === 0 && r.cells.length === 720, "720 sel, tanpa error");
  ok(r.crossLevel === 0, "tidak ada buku lintas level");
  ok(audit(r.cells, 2).length === 0, "audit bersih (tanpa pengulangan, kapasitas <= 2)");
  let diff = 0;
  for (const lv of LEVELS) {
    const T = books.filter((b) => b.level === lv);
    st.filter((s) => s.level === lv).forEach((s, k) => {
      for (let w = 1; w <= 12; w++) {
        const exp = T[(Math.floor(k / 2) + w - 1) % T.length].id;
        if (r.cells.find((c) => c.student_id === s.id && c.week === w)!.book_id !== exp) diff++;
      }
    });
  }
  ok(diff === 0, "setiap sel sama dengan rumus Excel (selisih 0)");
}

console.log("6 bulan (24 minggu)");
{
  const r = run(mk(20, 25, 15), 24);
  ok(r.errors.length === 0 && r.cells.length === 1440 && audit(r.cells, 2).length === 0, "1440 sel valid");
  ok(r.crossLevel === 0, "katalog 41/30/30 cukup tanpa lintas level");
}

console.log("12 bulan (48 minggu): fallback level");
{
  const st = mk(20, 25, 15);
  const r = run(st, 48);
  ok(r.errors.length === 0 && r.cells.length === 2880, "2880 sel, tanpa error");
  ok(audit(r.cells, 2).length === 0, "tidak ada pengulangan, kapasitas aman");
  ok(r.crossLevel > 0, `memakai buku lintas level (${r.crossLevel} penugasan)`);
  const p1 = st[0];
  const mine = r.cells.filter((c) => c.student_id === p1.id).sort((a, b) => a.week - b.week);
  ok(mine.slice(0, 41).every((c) => lvl.get(c.book_id) === "Pemula"), "Pemula: 41 minggu pertama semua level Pemula");
  ok(mine.slice(41).every((c) => lvl.get(c.book_id) === "Madya"), "Pemula: minggu 42-48 naik ke Madya");
  const mahir = st.find((s) => s.level === "Mahir")!;
  const mm = r.cells.filter((c) => c.student_id === mahir.id).sort((a, b) => a.week - b.week);
  ok(mm.slice(0, 30).every((c) => lvl.get(c.book_id) === "Mahir"), "Mahir: 30 minggu pertama level Mahir");
  ok(mm.slice(30).every((c) => lvl.get(c.book_id) === "Madya"), "Mahir: sisanya fallback ke Madya");
}

console.log("Lanjutan & kunci minggu berjalan");
{
  const st = mk(20, 25, 15);
  const first = run(st, 12);
  const hard = new Map<number, Set<number>>();
  for (const c of first.cells) { if (!hard.has(c.student_id)) hard.set(c.student_id, new Set()); hard.get(c.student_id)!.add(c.book_id); }
  const next = run(st, 12, { weekOffset: 12, hardRead: hard });
  ok(next.errors.length === 0, "program lanjutan 12 minggu berhasil");
  ok(next.cells.every((c) => !hard.get(c.student_id)!.has(c.book_id)), "tidak ada judul yang pernah dibaca di program sebelumnya");

  const locked = first.cells.filter((c) => c.week <= 5);
  const rebuilt = run(st, 24, { weekFrom: 6, locked });
  ok(rebuilt.errors.length === 0, "perpanjangan 12 -> 24 minggu dari minggu ke-6 berhasil");
  const all = [...locked, ...rebuilt.cells];
  ok(all.length === 60 * 24 && audit(all, 2).length === 0, "gabungan minggu terkunci + baru tetap bebas pengulangan");
}

console.log("Kasus tak layak & performa");
{
  const r150 = run(mk(150, 0, 0), 12);
  ok(r150.errors.length === 0 && audit(r150.cells, 2).length === 0 && r150.crossLevel > 0, `150 murid Pemula x 12 minggu layak lewat level lain (${r150.crossLevel} lintas level)`);
  const r102 = run(mk(10, 0, 0), 102);
  ok(r102.errors.length > 0 && /Minggu 102/.test(r102.errors[0]), "102 minggu > 101 judul: ditolak di minggu 102 (" + (r102.errors[0] ?? "").slice(0, 40) + "...)");
  const r200 = run(mk(70, 70, 60), 48);
  ok(r200.errors.length === 0 && audit(r200.cells, 2).length === 0, "200 murid x 48 minggu (nyaris penuh 202 slot) tetap valid");
  const t = Date.now();
  const r2 = run(mk(60, 40, 20), 48);
  console.log(`    120 murid x 48 minggu: ${Date.now() - t} ms, error=${r2.errors.length}`);
  ok(r2.errors.length === 0 && audit(r2.cells, 2).length === 0, "120 murid x 48 minggu valid");
}

console.log("Murid lebih banyak dari judul: judul dibagi rata, murid tidak pernah mengulang");
{
  const t0 = Date.now();
  const st = mk(100, 100, 100); // 300 murid, katalog 101 judul, copies = 1
  const r = run(st, 48, { copies: 1 });
  ok(r.errors.length === 0 && r.cells.length === 300 * 48, `300 murid x 48 minggu, copies=1: valid (${Date.now() - t0} ms)`);
  ok(audit(r.cells, 999).length === 0, "tidak ada murid yang mengulang judul");
  ok(r.peakShare >= 3 && r.peakShare <= 5, `satu judul dibaca paling banyak ${r.peakShare} murid per minggu (ideal 3)`);
  const r250 = run(mk(250, 0, 0), 12);
  ok(r250.errors.length === 0 && audit(r250.cells, 999).length === 0, "250 murid (> 202 slot) kini tetap dialokasikan");
  const full = run(mk(100, 100, 100), 101, { copies: 1 });
  ok(full.errors.length === 0 && audit(full.cells, 999).length === 0, "300 murid x 101 minggu: tiap murid membaca ke-101 judul tanpa ulang");
  const solo = run(mk(1, 0, 0), 48, { copies: 1 });
  ok(solo.errors.length === 0 && solo.peakShare === 1, "1 murid: peakShare 1");
}

console.log("Jadwal (WIB)");
{
  ok(firstMondayOfMonth("2027-01") === "2027-01-04", "Senin pertama Jan 2027 = 4 Jan");
  ok(firstMondayOfMonth("2026-12") === "2026-12-07", "Senin pertama Des 2026 = 7 Des (1 Des = Selasa)");
  ok(firstMondayOfMonth("2026-06") === "2026-06-01", "bulan yang dimulai Senin = tanggal 1");
  const start = "2027-01-04";
  const rel = releaseMs(start, 1);
  ok(new Date(rel).toISOString() === "2027-01-03T19:00:00.000Z", "rilis minggu 1 = Senin 02:00 WIB (Minggu 19:00 UTC)");
  ok(releasedWeeks(start, 12, rel - 1) === 0 && releasedWeeks(start, 12, rel) === 1, "tepat pukul 02:00 minggu 1 terbuka");
  ok(releasedWeeks(start, 12, releaseMs(start, 5)) === 5 && releasedWeeks(start, 12, releaseMs(start, 5) - 1) === 4, "minggu 5 terbuka tepat jam rilis");
  ok(releasedWeeks(start, 12, releaseMs(start, 99)) === 12, "tidak melebihi total minggu");
  ok(addDays(start, 84) === "2027-03-29", "lanjutan mulai 84 hari setelah mulai");
  ok(phase("siap", start, 12, rel - 5) === "terjadwal" && phase("siap", start, 12, rel + 1) === "berjalan" && phase("siap", start, 12, releaseMs(start, 12) + 7 * 86400000) === "selesai", "fase terjadwal/berjalan/selesai");
  ok(nextMonthStr(Date.UTC(2026, 10, 18)) === "2026-12" && nextMonthStr(Date.UTC(2026, 11, 30)) === "2027-01", "bulan depan");
}
console.log("Pilihan mulai program");
{
  const thu = Date.UTC(2026, 10, 19, 3, 0); // Kamis 19 Nov 2026 10:00 WIB
  ok(todayWib(thu) === "2026-11-19", "hari ini (WIB) = 2026-11-19");
  ok(todayWib(Date.UTC(2026, 10, 18, 18, 0)) === "2026-11-19", "Rabu 18 Nov 18:00 UTC = Kamis 01:00 WIB");
  ok(nextMonday(thu) === "2026-11-23", "Senin depan dari Kamis 19 Nov = 23 Nov");
  ok(nextMonday(Date.UTC(2026, 10, 23, 3, 0)) === "2026-11-30", "hari ini Senin: Senin depan = 7 hari lagi");
  ok(nextMonday(Date.UTC(2026, 10, 22, 3, 0)) === "2026-11-23", "hari ini Minggu: Senin depan = besok");
  ok(resolveStart("hari_ini", "", thu) === "2026-11-19" && resolveStart("senin_depan", "", thu) === "2026-11-23", "resolveStart hari_ini / senin_depan");
  ok(resolveStart("awal_bulan", "2026-12", thu) === "2026-12-07" && resolveStart("awal_bulan", "x", thu) === null, "resolveStart awal_bulan valid / tidak valid");
  ok(releasedWeeks("2026-11-19", 12, thu) === 1, "mulai hari ini: minggu 1 langsung terbuka");
  ok(dayName("2026-11-19") === "Kamis", "nama hari Kamis");
}
console.log(fails === 0 ? "\nSEMUA TES LULUS" : `\n${fails} TES GAGAL`);
process.exit(fails === 0 ? 0 : 1);
