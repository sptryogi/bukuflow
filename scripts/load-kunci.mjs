// Memuat kunci jawaban (10 soal x 101 judul) dari Excel ke database.
//   npm run db:kunci            -> muat ke database (aman diulang: menimpa)
//   npm run db:kunci -- --dry   -> hanya cek pencocokan judul
// Kolom Excel: ISBN_13, Judul, Level, Pembaca, Nomer Pertanyaan, Pertanyaan, Jawaban yang di harapkan.
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("./kunci/Kunci_Jawaban_101_Asesmen.xlsx", import.meta.url));
const norm = (s) => String(s).toLowerCase().replace(/&/g, " dan ").replace(/[^a-z0-9]+/g, " ").trim();
const ALIAS = { "terjadinya selat bali": "legenda selat bali" }; // judul di Excel/PDF beda dengan katalog
const dry = process.argv.includes("--dry");

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];
const rows = [];
ws.eachRow((r, i) => {
  if (i === 1) return;
  const v = (c) => { const x = r.getCell(c).value; return x && typeof x === "object" && "richText" in x ? x.richText.map((t) => t.text).join("") : x; };
  const no = Math.round(Number(v(5)));
  if (v(2) && no >= 1 && no <= 10) rows.push({ title: String(v(2)).trim(), no, question: String(v(6) ?? "").trim(), expected: String(v(7) ?? "").trim() });
});

let books;
let sql;
if (dry) {
  const { readFileSync } = await import("node:fs");
  books = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url), "utf8")).books.map((b, i) => ({ id: i + 1, title: b.title }));
} else {
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL belum diatur (jalankan lewat npm run db:kunci)."); process.exit(1); }
  const { neon } = await import("@neondatabase/serverless");
  sql = neon(process.env.DATABASE_URL);
  books = await sql.query("SELECT id, title FROM books");
}
const byTitle = new Map(books.map((b) => [norm(b.title), b]));
const used = new Set();
const unmatched = new Set();
let n = 0;
for (const r of rows) {
  const k = norm(r.title);
  const b = byTitle.get(ALIAS[k] ?? k);
  if (!b) { unmatched.add(r.title); continue; }
  used.add(b.id);
  if (!dry) {
    await sql.query(
      `INSERT INTO assessment_keys (book_id, no, question, expected) VALUES ($1, $2, $3, $4)
       ON CONFLICT (book_id, no) DO UPDATE SET question = EXCLUDED.question, expected = EXCLUDED.expected`,
      [b.id, r.no, r.question, r.expected],
    );
  }
  n++;
}
console.log(`${dry ? "[dry] cocok" : "Dimuat"}: ${n} dari ${rows.length} baris soal, ${used.size} judul.`);
if (unmatched.size) console.log("Judul Excel tidak ada di katalog:\n - " + [...unmatched].join("\n - "));
const none = books.filter((b) => !used.has(b.id)).map((b) => b.title);
if (none.length) console.log("Judul katalog tanpa kunci:\n - " + none.join("\n - "));
