// Tes fitur asesmen: jendela jadwal, pengisian lembar PDF, parser nilai, pencocokan murid.
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { assessWindow, sheetDate } from "../src/lib/schedule.ts";
import { openTemplate, stampSheet } from "../src/lib/sheet.ts";
import { matchStudent, parseGrade, titleMatches } from "../src/lib/gradeParse.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) fails++; };

console.log("Jendela asesmen (WIB)");
{
  const w = assessWindow("2026-11-23", 1, 3, 6); // mulai Senin 23 Nov
  ok(w.opens === Date.UTC(2026, 10, 25, 19, 0), "cetak buka Kamis 26 Nov 02:00 WIB");
  ok(w.closes === Date.UTC(2026, 10, 29, 19, 0) + 6 * 3_600_000, "unggah tutup Senin 30 Nov 08:00 WIB");
  const t = assessWindow("2026-11-19", 1, 0, 6); // uji coba: mulai hari ini (Kamis), buka langsung
  ok(t.opens === Date.UTC(2026, 10, 18, 19, 0), "uji coba (hari ke-0): cetak buka saat minggu dirilis");
  ok(sheetDate(Date.UTC(2026, 10, 25, 19, 0)) === "26 Nov 2026", "tanggal lembar: " + sheetDate(Date.UTC(2026, 10, 25, 19, 0)));
}

console.log("Lembar PDF");
{
  const raw = readFileSync(new URL("./asesmen-stock/stok-1-50.pdf", import.meta.url));
  const src = await PDFDocument.load(raw);
  const one = await PDFDocument.create();
  const [p0] = await one.copyPages(src, [27]); // DEWI SARTIKA (halaman 28)
  one.addPage(p0);
  const tpl = await openTemplate(Buffer.from(await one.save()).toString("base64"));
  const bytes = await stampSheet(tpl, { nis: "2024001", name: "Siti Nurhaliza Ánita Putri", date: "26 Nov 2026" });
  const out = await PDFDocument.load(bytes);
  ok(out.getPageCount() === 1, "1 halaman per murid");
  ok(bytes.length < 60_000, `ukuran per murid ${(bytes.length / 1024).toFixed(1)} KB`);
  writeFileSync(process.argv[2] ?? "/tmp/sheet.pdf", bytes);
}

console.log("Parser nilai");
{
  const raw = '```json\n{"nis":"2024001","nama":"Siti","judul":"Dewi Sartika","soal":[' +
    Array.from({ length: 10 }, (_, i) => `{"no":${i + 1},"skor":${i === 9 ? 15 : 7},"ringkas":"x"}`).join(",") + '],"perlu_cek":false,"alasan":""}\n```';
  const g = parseGrade(raw);
  ok(!!g && g.soal.length === 10 && g.total === 7 * 9 + 10, "skor dijepit 0-10 per soal, total dihitung ulang = " + g?.total);
  ok(parseGrade("bukan json") === null, "teks bukan JSON ditolak");
  ok(parseGrade('{"nis":"1","soal":[{"no":1,"skor":5}]}')?.perluCek === true, "kurang dari 10 soal terbaca: perlu cek");
}

console.log("Pencocokan murid & judul");
{
  const c = [{ id: 1, nis: "0123", name: "Budi Santoso" }, { id: 2, nis: "0456", name: "Ani Lestari" }];
  ok(matchStudent(c, "0456", "")?.id === 2, "NIS persis");
  ok(matchStudent(c, "123", "")?.id === 1, "NIS tanpa nol di depan");
  ok(matchStudent(c, "", "ani lestari")?.id === 2, "nama persis saat NIS tak terbaca");
  ok(matchStudent(c, "999", "Orang Lain") === null, "tidak cocok: null");
  ok(titleMatches("Dewi Sartika", "DEWI SARTIKA") && titleMatches("", "Apa saja") && !titleMatches("Malin Kundang", "Danau Toba"), "kecocokan judul");
}
console.log(fails === 0 ? "\nSEMUA TES LULUS" : `\n${fails} TES GAGAL`);
process.exit(fails ? 1 : 0);
