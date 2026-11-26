// Memuat template asesmen (1 halaman per judul) dari PDF stok ke database.
//   npm run db:asesmen            -> muat ke database (DATABASE_URL dari .env.local); aman diulang (menimpa)
//   npm run db:asesmen -- --dry   -> hanya cek pencocokan judul PDF dengan katalog, tanpa menyentuh database
// Pencocokan berdasarkan JUDUL (bukan urutan halaman), karena urutan PDF tidak sama dengan urutan katalog.
import { readFileSync, readdirSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const dir = new URL("./asesmen-stock/", import.meta.url);
// Semua PDF di folder ini dibaca otomatis: judul tiap halaman diambil dari teks di bagian atas lembar.
// Jadi nama/jumlah file bebas (mis. stok-1-50.pdf + stok-50-101.pdf); tidak perlu file pemetaan lagi.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
const map = [];
for (const file of files) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(new URL(file, dir))), verbosity: 0 }).promise;
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const H = pg.view[3];
    const items = (await pg.getTextContent()).items.filter((t) => t.str.trim() && H - t.transform[5] > 38 && H - t.transform[5] < 75 && !/^asesmen membaca$/i.test(t.str.trim()));
    items.sort((a, b) => Math.round(b.transform[5] / 4) - Math.round(a.transform[5] / 4) || a.transform[4] - b.transform[4]);
    const title = items.map((t) => t.str).join(" ").replace(/\s+/g, " ").trim();
    if (title) map.push({ file, page: n, title });
  }
}
console.log(`Terbaca ${map.length} halaman dari ${files.length} file PDF.`);
const norm = (s) => s.toLowerCase().replace(/&/g, " dan ").replace(/[^a-z0-9]+/g, " ").trim();
// Judul di PDF yang berbeda penulisan dengan katalog.
const ALIAS = { "terjadinya selat bali": "legenda selat bali" };

const dry = process.argv.includes("--dry");
let books;
let sql;
if (dry) {
  books = JSON.parse(readFileSync(new URL("../seed.json", dir), "utf8")).books.map((b, i) => ({ id: i + 1, title: b.title }));
} else {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL belum diatur (jalankan lewat npm run db:asesmen).");
    process.exit(1);
  }
  const { neon } = await import("@neondatabase/serverless");
  sql = neon(process.env.DATABASE_URL);
  books = await sql.query("SELECT id, title FROM books");
}
const byTitle = new Map(books.map((b) => [norm(b.title), b]));

const srcs = new Map();
const pdfOf = async (f) => {
  if (!srcs.has(f)) srcs.set(f, await PDFDocument.load(readFileSync(new URL(f, dir))));
  return srcs.get(f);
};

let ok = 0;
const unmatched = [];
const used = new Set();
for (const m of map) {
  const key = norm(m.title);
  const book = byTitle.get(ALIAS[key] ?? key);
  if (!book) {
    unmatched.push(`${m.file} hal. ${m.page}: "${m.title}"`);
    continue;
  }
  used.add(book.id);
  if (dry) { ok++; continue; }
  const out = await PDFDocument.create();
  const [pg] = await out.copyPages(await pdfOf(m.file), [m.page - 1]);
  out.addPage(pg);
  const b64 = Buffer.from(await out.save()).toString("base64");
  await sql.query(
    `INSERT INTO assessment_templates (book_id, pdf_b64) VALUES ($1, $2)
     ON CONFLICT (book_id) DO UPDATE SET pdf_b64 = EXCLUDED.pdf_b64, updated_at = now()`,
    [book.id, b64],
  );
  ok++;
}
console.log(`${dry ? "[dry] cocok" : "Dimuat"}: ${ok} dari ${map.length} halaman PDF.`);
if (unmatched.length) console.log("Tidak ada di katalog (cek penulisan judul):\n - " + unmatched.join("\n - "));
const noTpl = books.filter((b) => !used.has(b.id)).map((b) => b.title);
if (noTpl.length) console.log("Judul katalog yang belum punya asesmen:\n - " + noTpl.join("\n - "));
