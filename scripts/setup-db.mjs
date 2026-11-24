// Membuat tabel + mengisi katalog buku dari Excel.
//   npm run db:setup           -> aman dijalankan berulang kali
//   npm run db:reset           -> HAPUS semua tabel lalu buat ulang (data hilang!)
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum diatur. Salin .env.example menjadi .env.local lalu isi.");
  process.exit(1);
}
const sql = neon(url);

const statements = (file) =>
  readFileSync(new URL(`../db/${file}`, import.meta.url), "utf8")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.split("\n").every((l) => l.trim().startsWith("--")));

if (process.argv.includes("--reset")) {
  console.log("Menghapus tabel lama...");
  await sql.query("DROP TABLE IF EXISTS assessment_queue, assessment_downloads, assessment_results, assessment_templates, throttle, allocations, program_students, programs, students, users, books, institutions, settings CASCADE");
}

for (const file of ["schema.sql", "seed.sql"]) {
  const list = statements(file);
  for (const stmt of list) await sql.query(stmt);
  console.log(`✓ ${file} (${list.length} perintah)`);
}

const [b] = await sql.query("SELECT count(*)::int AS n FROM books");
console.log(`Selesai. Katalog buku: ${b.n} judul. Akun admin dibuat otomatis saat login pertama (lihat ADMIN_EMAIL / ADMIN_PASSWORD).`);
