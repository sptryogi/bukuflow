// Antrean penilaian latar belakang. Unggahan hanya disimpan (cepat); pembacaan & penilaian AI dikerjakan di sini,
// oleh SATU pekerja sekaligus (dijaga "lease" di tabel settings) agar tidak membanjiri API penilai.
import { sql } from "./db";
import { assessAnswers, transcribeScan } from "./grader";
import { matchStudent, titleMatches } from "./gradeParse";
import { nameOk, total } from "./assess";
import { saveResult, weekRows, type SheetRow } from "./asesmen";
import { keysOf, upsertSheet } from "./sheets";

type Row = Record<string, any>;
const q = () => sql();

const BATCH = 4; // lembar dinilai paralel per putaran
const MAX_TRY = 2; // percobaan per lembar bila layanan penilai gagal
const LEASE_KEY = "queue_lease";

export async function enqueue(a: { programId: number; week: number; studentId: number | null; b64: string; mediaType: string; label: string; userId: number; isTest?: boolean }): Promise<void> {
  await q().query(
    `INSERT INTO assessment_queue (program_id, week, student_id, image_b64, media_type, label, uploaded_by, is_test) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [a.programId, a.week, a.studentId, a.b64, a.mediaType, a.label.slice(0, 120), a.userId, a.isTest === true],
  );
}

async function takeLease(ms: number): Promise<boolean> {
  const now = Date.now();
  const r = await q().query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value WHERE settings.value::bigint < $3 RETURNING key`,
    [LEASE_KEY, String(now + ms), now],
  );
  return r.length > 0;
}
const dropLease = () => q().query(`UPDATE settings SET value = '0' WHERE key = $1`, [LEASE_KEY]).catch(() => {});

export async function pendingCount(): Promise<number> {
  const r = await q().query(`SELECT count(*)::int AS n FROM assessment_queue WHERE status = 'menunggu'`);
  return r[0].n as number;
}

type Item = { id: number; program_id: number; week: number; student_id: number | null; image_b64: string; media_type: string; attempts: number; uploaded_by: number | null; is_test: boolean };

async function gradeItem(it: Item, rowsOf: (p: number, w: number) => Promise<SheetRow[]>): Promise<{ status: "selesai" | "perlu_cek" | "gagal" | "ulang"; student?: number; score?: number; note: string }> {
  const rows = (await rowsOf(it.program_id, it.week)).filter((r) => r.book_id);
  let target: SheetRow | null = it.student_id ? rows.find((r) => r.student_id === it.student_id) ?? null : null;
  if (it.student_id && !target) return { status: "gagal", note: "Murid ini tidak punya buku di minggu tersebut." };
  const retry = (error: string) => ({ status: it.attempts < MAX_TRY ? ("ulang" as const) : ("gagal" as const), note: error });
  const img = Buffer.from(it.image_b64, "base64");

  // Tahap 1: OCR (transkrip tulisan tangan apa adanya).
  const t = await transcribeScan(img, it.media_type);
  if (!t.ok) return retry(t.error);
  const ocr = t.ocr;

  if (!target) {
    const hit = matchStudent(rows.map((r) => ({ id: r.student_id, nis: r.nis, name: r.name })), ocr.nis, ocr.nama);
    target = hit ? rows.find((r) => r.student_id === hit.id) ?? null : null;
    if (!target) return { status: "gagal", note: `NIS/nama pada kertas${ocr.nis ? ` (${ocr.nis})` : ""} tidak cocok dengan murid yang menerima asesmen minggu ini.` };
  }
  const keys = await keysOf(target.book_id!);
  if (keys.length < 10) return { status: "gagal", note: `Kunci jawaban "${target.title}" belum ada (jalankan npm run db:kunci).` };

  // Tahap 2: penilaian teks terhadap kunci, menyesuaikan level murid; skor hanya 0/5/10.
  const as = await assessAnswers(target.level, target.title!, keys, ocr.jawaban);
  if (!as.ok) return retry(as.error);

  const notes: string[] = [];
  const nisDiff = !!ocr.nis && ocr.nis.replace(/\W/g, "") !== target.nis.replace(/\W/g, "");
  const nOk = nameOk(ocr.nama, target.name);
  const hold = !nOk; // nama di kertas berbeda dari murid terdaftar: nilai belum boleh dilekatkan ke NIS
  if (hold) notes.push(`Nama di kertas "${ocr.nama}" berbeda dari ${target.name}; nilai ditahan sampai dikonfirmasi guru.`);
  else if (nisDiff) notes.push(`NIS di kertas (${ocr.nis}) berbeda dari ${target.nis}.`);
  if (ocr.judul && !titleMatches(ocr.judul, target.title!)) notes.push(`Judul di kertas "${ocr.judul}" berbeda dari alokasi "${target.title}".`);
  if (as.a.butir.some((b) => b.tahan)) notes.push("Ada jawaban yang tidak terbaca.");
  if (ocr.perluCek) notes.push(ocr.alasan || "Foto kurang jelas.");

  const status = notes.length ? "perlu_cek" : "dinilai";
  const sum = total(as.a.butir);
  await upsertSheet({
    programId: it.program_id, studentId: target.student_id, week: it.week, isTest: it.is_test, bookId: target.book_id, scanB64: it.image_b64, scanType: it.media_type,
    ocr, answers: ocr.jawaban, grade: { ...as.a, total: sum, nisRead: ocr.nis, namaRead: ocr.nama, judulRead: ocr.judul }, status, hold, note: notes.join(" "), userId: it.uploaded_by,
  });
  if (!it.is_test && !hold) await saveResult(it.program_id, target.student_id, it.week, sum, status, { butir: as.a.butir, alasan: notes.join(" ") }, it.uploaded_by);
  return { status: status === "perlu_cek" ? "perlu_cek" : "selesai", student: target.student_id, score: sum, note: notes.join(" ") };
}

/** Kerjakan antrean sampai habis atau waktu `budgetMs` habis. Mengembalikan true bila masih ada yang menunggu. */
export async function runQueue(budgetMs: number): Promise<boolean> {
  if (!(await takeLease(budgetMs + 20_000))) return false; // sudah ada pekerja lain
  const end = Date.now() + budgetMs;
  const cache = new Map<string, Promise<SheetRow[]>>();
  const rowsOf = (p: number, w: number) => {
    const k = `${p}:${w}`;
    if (!cache.has(k)) cache.set(k, weekRows(p, w));
    return cache.get(k)!;
  };
  try {
    await q().query(`UPDATE assessment_queue SET status = 'menunggu' WHERE status = 'diproses' AND started_at < now() - interval '3 minutes'`);
    while (Date.now() < end - 12_000) {
      const got = (await q().query(
        `UPDATE assessment_queue SET status = 'diproses', started_at = now(), attempts = attempts + 1
          WHERE id IN (SELECT id FROM assessment_queue WHERE status = 'menunggu' ORDER BY id LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)
        RETURNING id, program_id, week, student_id, image_b64, media_type, attempts, uploaded_by, is_test`,
      )) as Row[];
      if (!got.length) break;
      await Promise.all(
        (got as Item[]).map(async (it) => {
          let r: Awaited<ReturnType<typeof gradeItem>>;
          try {
            r = await gradeItem(it, rowsOf);
          } catch (e) {
            console.error("Antrean gagal:", e);
            r = { status: it.attempts < MAX_TRY ? "ulang" : "gagal", note: "Kesalahan sistem saat menilai." };
          }
          if (r.status === "ulang") {
            await q().query(`UPDATE assessment_queue SET status = 'menunggu', note = $2 WHERE id = $1`, [it.id, r.note]);
          } else {
            // gambar dibuang setelah selesai agar database tidak membengkak; yang gagal disimpan untuk diproses ulang
            await q().query(
              `UPDATE assessment_queue SET status = $2, result_student = $3, score = $4, note = $5, finished_at = now(), image_b64 = CASE WHEN $2 = 'gagal' THEN image_b64 ELSE NULL END WHERE id = $1`,
              [it.id, r.status, r.student ?? null, r.score ?? null, r.note.slice(0, 400)],
            );
          }
        }),
      );
    }
  } finally {
    await dropLease();
  }
  return (await pendingCount()) > 0;
}

/** Jalankan antrean, lalu sambung pekerja baru bila masih ada sisa (batas waktu fungsi per panggilan). */
export async function runAndChain(origin: string): Promise<void> {
  const more = await runQueue(42_000);
  if (more) await fetch(`${origin}/api/asesmen/worker`, { method: "POST", signal: AbortSignal.timeout(5000) }).catch(() => {});
}

export type QueueStat = { menunggu: number; diproses: number; selesai: number; perlu_cek: number; gagal: number };

export async function queueStat(programId: number, week: number, isTest = false): Promise<{ stat: QueueStat; failed: { id: number; label: string | null; note: string | null }[] }> {
  const r = await q().query(`SELECT status, count(*)::int AS n FROM assessment_queue WHERE program_id = $1 AND week = $2 AND is_test = $3 GROUP BY status`, [programId, week, isTest]);
  const stat: QueueStat = { menunggu: 0, diproses: 0, selesai: 0, perlu_cek: 0, gagal: 0 };
  for (const x of r) stat[x.status as keyof QueueStat] = x.n;
  const failed = (await q().query(`SELECT id, label, note FROM assessment_queue WHERE program_id = $1 AND week = $2 AND is_test = $3 AND status = 'gagal' ORDER BY id DESC LIMIT 30`, [programId, week, isTest])) as { id: number; label: string | null; note: string | null }[];
  return { stat, failed };
}

export async function retryFailed(programId: number, week: number, isTest = false): Promise<void> {
  await q().query(`UPDATE assessment_queue SET status = 'menunggu', attempts = 0 WHERE program_id = $1 AND week = $2 AND is_test = $3 AND status = 'gagal' AND image_b64 IS NOT NULL`, [programId, week, isTest]);
}
