// Parser murni untuk hasil penilai AI (tanpa dependensi Next) agar bisa diuji.
export type Soal = { no: number; skor: number; ringkas: string };
export type Grade = {
  nis: string;
  nama: string;
  judul: string;
  soal: Soal[];
  total: number; // 0..100 = jumlah skor 10 soal
  perluCek: boolean;
  alasan: string;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Ambil objek JSON dari teks model (boleh dibungkus ``` atau teks lain). */
export function parseGrade(text: string): Grade | null {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
  const raw = Array.isArray(j.soal) ? (j.soal as Record<string, unknown>[]) : [];
  const soal = raw
    .map((s, i) => ({ no: Math.round(num(s.no)) || i + 1, skor: Math.min(10, Math.max(0, Math.round(num(s.skor) * 10) / 10)), ringkas: String(s.ringkas ?? "").slice(0, 200) }))
    .slice(0, 10);
  if (!soal.length) return null;
  const total = Math.round(soal.reduce((x, s) => x + s.skor, 0) * 10) / 10; // dihitung ulang, bukan percaya total dari model
  const perluCek = j.perlu_cek === true || soal.length < 10;
  return {
    nis: String(j.nis ?? "").trim(),
    nama: String(j.nama ?? "").trim(),
    judul: String(j.judul ?? "").trim(),
    soal,
    total,
    perluCek,
    alasan: String(j.alasan ?? "").slice(0, 300) || (soal.length < 10 ? `Hanya ${soal.length} soal terbaca.` : ""),
  };
}

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Cocokkan NIS/nama hasil baca dengan daftar murid yang memang mendapat asesmen minggu itu. */
export function matchStudent<T extends { id: number; nis: string; name: string }>(cands: T[], nis: string, nama: string): T | null {
  const n = alnum(nis);
  if (n) {
    const hit = cands.filter((c) => alnum(c.nis) === n);
    if (hit.length === 1) return hit[0];
    const stripped = n.replace(/^0+/, "");
    const hit2 = cands.filter((c) => alnum(c.nis).replace(/^0+/, "") === stripped && stripped);
    if (hit2.length === 1) return hit2[0];
  }
  const w = words(nama);
  if (w.length >= 3) {
    const hit = cands.filter((c) => words(c.name) === w);
    if (hit.length === 1) return hit[0];
  }
  return null;
}

/** Judul pada kertas cocok dengan judul yang dialokasikan? (longgar: salah satu memuat yang lain) */
export function titleMatches(read: string, expected: string): boolean {
  const a = words(read);
  const b = words(expected);
  if (!a) return true; // tidak terbaca: jangan menghukum murid
  return a.includes(b) || b.includes(a) || b.split(" ").filter((x) => x.length > 3 && a.includes(x)).length >= Math.min(2, b.split(" ").filter((x) => x.length > 3).length);
}
