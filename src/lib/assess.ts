// Logika murni penilaian asesmen (tanpa jaringan/DB): prompt, parser, pembulatan skor 0/5/10, dan penyusun teks evaluasi.
export type Level = "Pemula" | "Madya" | "Mahir";
export type Ocr = { nis: string; nama: string; judul: string; jawaban: string[]; perluCek: boolean; alasan: string };
export type Butir = { no: number; skor: 0 | 5 | 10; komentar: string; tahan: boolean };
export type Aspek = { kuat: number[]; perbaikan: number[]; tahan: number[]; saran: string };
export type AspekKey = "tata_bahasa" | "substansi" | "berpikir_kritis";
export type Assessment = { butir: Butir[]; aspek: Record<AspekKey, Aspek>; total: number };
export type Key = { no: number; question: string; expected: string };

export const ASPEK_LABEL: Record<AspekKey, string> = { tata_bahasa: "Tata bahasa", substansi: "Substansi", berpikir_kritis: "Berpikir kritis" };
export const UNREADABLE = "[tidak terbaca]";

export const snap = (v: unknown): 0 | 5 | 10 => {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return n >= 7.5 ? 10 : n >= 2.5 ? 5 : 0;
};

function json(text: string): Record<string, unknown> | null {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

export function ocrPrompt(): string {
  return `Ini foto/scan satu lembar "ASESMEN MEMBACA" yang dijawab murid dengan tulisan tangan (10 soal bernomor).
Tugasmu HANYA menyalin (transkripsi/OCR), bukan menilai:
1. Baca NIS, Nama, dan judul buku di bagian atas kertas.
2. Untuk soal 1-10, salin jawaban tulisan tangan APA ADANYA. Jangan memperbaiki ejaan, tata bahasa, atau isi.
3. Bagian yang tidak bisa dibaca tulis ${UNREADABLE}. Jawaban kosong tulis "" (string kosong).
4. Set perlu_cek=true bila foto buram/terpotong, NIS/nama tidak terbaca, atau ada soal yang tidak dapat dibaca; jelaskan singkat di "alasan".

Balas HANYA JSON tanpa teks lain, tepat 10 elemen pada "jawaban" (urut soal 1..10):
{"nis":"","nama":"","judul":"","jawaban":["","","","","","","","","",""],"perlu_cek":false,"alasan":""}`;
}

export function parseOcr(text: string): Ocr | null {
  const j = json(text);
  if (!j) return null;
  // Terima: ["..."], [{"no":1,"teks":"..."}], atau {"1":"..."}.
  const raw = j.jawaban ?? j.answers ?? j.soal;
  const pick = (v: unknown): string => (v && typeof v === "object" ? String((v as Record<string, unknown>).teks ?? (v as Record<string, unknown>).jawaban ?? (v as Record<string, unknown>).text ?? "") : String(v ?? ""));
  let arr: unknown[];
  if (Array.isArray(raw)) {
    const byNo = new Map<number, unknown>();
    raw.forEach((v, i) => byNo.set(v && typeof v === "object" && Number.isFinite(Number((v as Record<string, unknown>).no)) ? Number((v as Record<string, unknown>).no) : i + 1, v));
    arr = Array.from({ length: 10 }, (_, i) => byNo.get(i + 1));
  } else if (raw && typeof raw === "object") arr = Array.from({ length: 10 }, (_, i) => (raw as Record<string, unknown>)[String(i + 1)]);
  else return null;
  const jawaban = arr.map((v) => pick(v).trim().slice(0, 1500));
  return { nis: String(j.nis ?? "").trim(), nama: String(j.nama ?? "").trim(), judul: String(j.judul ?? "").trim(), jawaban, perluCek: j.perlu_cek === true, alasan: String(j.alasan ?? "").trim().slice(0, 300) };
}

const LEVEL_RULE: Record<string, string> = {
  Pemula: "Murid level PEMULA: maklumi ejaan, tanda baca, kalimat tidak utuh, dan bahasa sederhana. Nilai terutama pemahaman isi; jawaban singkat yang benar boleh 10.",
  Madya: "Murid level MADYA: maklumi salah ketik dan ejaan ringan. Harapkan kalimat cukup jelas dan jawaban cukup lengkap.",
  Mahir: "Murid level MAHIR: maklumi salah ketik, tetapi harapkan jawaban lengkap, tepat, dan untuk soal pendapat disertai alasan serta bukti dari bacaan.",
};

export function assessPrompt(level: string, title: string, keys: Key[], answers: string[]): string {
  const blok = keys
    .map((k) => `Soal ${k.no}: ${k.question}\nEkspektasi/kriteria: ${k.expected}\nJawaban murid: ${answers[k.no - 1]?.trim() || "(kosong)"}`)
    .join("\n\n");
  return `Kamu guru penilai asesmen membaca. Buku: "${title}". ${LEVEL_RULE[level] ?? LEVEL_RULE.Madya}

Aturan skor tiap soal (HANYA 0, 5, atau 10):
- 10 = memenuhi ekspektasi/kriteria (untuk "Contoh:" jawaban lain yang maknanya setara juga 10).
- 5 = sebagian benar, kurang lengkap, atau alasan lemah.
- 0 = salah, kosong, atau tidak relevan.
- Jawaban yang mengandung ${UNREADABLE}: beri skor 0 dan tahan=true (bukti belum pasti, bukan jawaban kosong).
Untuk soal berawalan "Kriteria:" nilai terpenuhinya kriteria itu (pendapat/alasan), bukan benar-salah mutlak.

Setelah itu isi evaluasi tiga aspek dengan menyebut NOMOR soal:
- tata_bahasa: kejelasan kalimat, kata sesuai tugas, huruf kapital, tanda baca (disesuaikan dengan level murid).
- substansi: ketepatan isi jawaban (umumnya soal faktual).
- berpikir_kritis: penalaran dan alasan (umumnya soal pendapat).
Tiap aspek: "kuat" (nomor dengan bukti kuat), "perbaikan" (nomor yang perlu diperbaiki), "tahan" (nomor yang belum bisa dinilai pasti karena tidak terbaca), "saran" (1-2 kalimat arahan latihan untuk murid, bahasa Indonesia sederhana).

${blok}

Balas HANYA JSON tanpa teks lain:
{"butir":[{"no":1,"skor":10,"komentar":"<=15 kata","tahan":false}],"aspek":{"tata_bahasa":{"kuat":[],"perbaikan":[],"tahan":[],"saran":""},"substansi":{"kuat":[],"perbaikan":[],"tahan":[],"saran":""},"berpikir_kritis":{"kuat":[],"perbaikan":[],"tahan":[],"saran":""}}}
"butir" harus berisi tepat 10 elemen, soal 1..10.`;
}

const nums = (v: unknown): number[] => (Array.isArray(v) ? [...new Set(v.map((x) => Math.round(Number(x))).filter((n) => n >= 1 && n <= 10))].sort((a, b) => a - b) : []);
const aspek = (v: unknown): Aspek => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { kuat: nums(o.kuat), perbaikan: nums(o.perbaikan), tahan: nums(o.tahan), saran: String(o.saran ?? "").trim().slice(0, 400) };
};

/** Skor dibulatkan ke 0/5/10 dan total DIHITUNG ULANG (bukan dari model). Soal yang tidak dikembalikan model = 0 + tahan. */
export function parseAssessment(text: string, answers: string[]): Assessment | null {
  const j = json(text);
  if (!j || !Array.isArray(j.butir)) return null;
  const by = new Map<number, Record<string, unknown>>();
  for (const b of j.butir as Record<string, unknown>[]) by.set(Math.round(Number(b?.no)), b);
  const butir: Butir[] = Array.from({ length: 10 }, (_, i) => {
    const b = by.get(i + 1);
    const unread = answers[i]?.includes(UNREADABLE) ?? false;
    return { no: i + 1, skor: b ? snap(b.skor) : 0, komentar: String(b?.komentar ?? (b ? "" : "Tidak dinilai model.")).trim().slice(0, 160), tahan: unread || b?.tahan === true || !b };
  });
  const a = (j.aspek ?? {}) as Record<string, unknown>;
  return { butir, aspek: { tata_bahasa: aspek(a.tata_bahasa), substansi: aspek(a.substansi), berpikir_kritis: aspek(a.berpikir_kritis) }, total: butir.reduce((s, x) => s + x.skor, 0) };
}

export const total = (b: { skor: number }[]) => b.reduce((s, x) => s + x.skor, 0);

const list = (n: number[]) => n.join(", ");

/** Kalimat evaluasi per aspek, disusun tetap (bukan karangan model) dari daftar nomor + saran. */
export function aspekText(a: Aspek): string {
  const out: string[] = [];
  out.push(a.kuat.length ? `Bukti relatif kuat pada nomor ${list(a.kuat)}.` : "Belum ada butir dengan bukti kuat pada aspek ini.");
  if (a.tahan.length) out.push(`Nilai aspek ditahan; baca ulang nomor ${list(a.tahan)}.`);
  if (a.perbaikan.length) out.push(`Fokus perbaikan nomor ${list(a.perbaikan)}.`);
  if (a.saran) out.push(a.saran);
  return out.join(" ");
}

export type Meta = { registered: string; nis: string; nama: string; nisRead: string; hold: boolean; tahan: number[] };

export function catatan(m: Meta): string[] {
  const out: string[] = [];
  const same = m.nama && norm(m.nama) === norm(m.registered);
  out.push(m.nama ? `Nama tulisan tangan ${m.nama}${same ? "" : `; nama terdaftar ${m.registered}`}.` : `Nama tulisan tangan tidak terbaca; nama terdaftar ${m.registered}.`);
  if (m.nisRead && m.nisRead.replace(/\W/g, "") !== m.nis.replace(/\W/g, "")) out.push(`NIS di kertas ${m.nisRead}; NIS terdaftar ${m.nis}.`);
  if (m.tahan.length) out.push(`Ejaan jawaban ${list(m.tahan)} kurang jelas; perlu verifikasi.`);
  out.push("Penanda [tidak terbaca] atau poin ditahan berarti bukti belum pasti, bukan jawaban kosong. Skor satu aspek ditahan bila ada butirnya yang belum terbaca.");
  if (m.hold) out.push("Nilai pada lembar dengan identitas berbeda belum boleh dilekatkan ke akun/NIS sampai nama dikonfirmasi.");
  return out;
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Nama di kertas "cocok" bila ada kata (>=3 huruf) yang sama dengan nama terdaftar; kosong = tidak diketahui (dianggap cocok). */
export function nameOk(read: string, registered: string): boolean {
  if (!norm(read)) return true;
  const r = new Set(norm(registered).split(" ").filter((t) => t.length >= 3));
  return norm(read).split(" ").some((t) => t.length >= 3 && r.has(t));
}
