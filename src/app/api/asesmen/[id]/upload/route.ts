import { actor } from "@/lib/session";
import { programFor, saveResult, templateOf, weekRows, windowOf, type SheetRow } from "@/lib/asesmen";
import { gradeScan, graderReady } from "@/lib/grader";
import { matchStudent, titleMatches } from "@/lib/gradeParse";
import { throttle } from "@/lib/q";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX = 4 * 1024 * 1024;

function mediaType(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

const json = (body: object, status = 200) => Response.json(body, { status });

/** POST multipart: week, file (foto/scan 1 lembar), student (opsional). Membaca & menilai langsung. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return json({ ok: false, error: "Sesi berakhir. Silakan login ulang." }, 401);
  }
  const got = await programFor(user, Number((await ctx.params).id));
  if ("error" in got) return json({ ok: false, error: got.error }, got.status);
  const { p } = got;

  const fd = await req.formData();
  const week = Number(fd.get("week"));
  const only = Number(fd.get("student")) || null;
  const file = fd.get("file");
  if (!Number.isInteger(week) || week < 1 || week > p.weeks) return json({ ok: false, error: "Minggu tidak valid." }, 400);
  if (!(file instanceof File) || !file.size) return json({ ok: false, error: "File tidak ada." }, 400);
  if (file.size > MAX) return json({ ok: false, error: "Ukuran file lebih dari 4 MB." }, 413);

  const w = await windowOf(p, week);
  const now = Date.now();
  if (user.role === "guru" && (now < w.opens || now > w.closes)) {
    return json({ ok: false, error: now < w.opens ? "Unggah nilai belum dibuka untuk minggu ini." : "Batas unggah minggu ini sudah lewat. Hubungi admin." }, 403);
  }
  if (!graderReady()) return json({ ok: false, error: "Penilaian otomatis belum aktif (ANTHROPIC_API_KEY). Isi nilai manual di tabel." }, 503);
  if (!(await throttle(`grade:${user.id}`, 800, 3600))) return json({ ok: false, error: "Terlalu banyak unggahan dalam satu jam." }, 429);

  const buf = Buffer.from(await file.arrayBuffer());
  const mt = mediaType(buf);
  if (!mt) return json({ ok: false, error: "Format harus JPG, PNG, atau WEBP." }, 415);

  const rows = (await weekRows(p.id, week)).filter((r) => r.book_id);
  let target: SheetRow | null = only ? rows.find((r) => r.student_id === only) ?? null : null;
  if (only && !target) return json({ ok: false, error: "Murid ini tidak punya buku di minggu tersebut." }, 400);

  // Judul untuk penilaian: murid sudah diketahui -> bukunya; belum -> baca NIS dulu dari kertas (judul acuan sementara kosong).
  const probe = target ?? null;
  const first = await gradeScan(buf, mt, probe?.title ?? null, probe ? (await templateOf(probe.book_id!))?.rubric ?? null : null);
  if (!first.ok) return json({ ok: false, error: first.error }, 502);
  let grade = first.grade;

  if (!target) {
    const hit = matchStudent(rows.map((r) => ({ id: r.student_id, nis: r.nis, name: r.name })), grade.nis, grade.nama);
    target = hit ? rows.find((r) => r.student_id === hit.id) ?? null : null;
    if (!target) return json({ ok: false, error: `NIS/nama pada kertas${grade.nis ? ` (${grade.nis})` : ""} tidak cocok dengan murid yang menerima asesmen minggu ini.` }, 422);
    // Nilai ulang dengan judul & rubrik yang benar bila perlu (judul terbaca dari kertas berbeda).
    if (!titleMatches(grade.judul, target.title!)) {
      grade = { ...grade, perluCek: true, alasan: `Judul di kertas "${grade.judul}" berbeda dari alokasi "${target.title}". ${grade.alasan}`.trim() };
    }
  } else if (grade.nis && grade.nis.replace(/\W/g, "") !== target.nis.replace(/\W/g, "")) {
    grade = { ...grade, perluCek: true, alasan: `NIS di kertas (${grade.nis}) berbeda dari ${target.nis}. ${grade.alasan}`.trim() };
  }

  const status = grade.perluCek ? "perlu_cek" : "dinilai";
  await saveResult(p.id, target.student_id, week, grade.total, status, { soal: grade.soal, alasan: grade.alasan, dibaca: { nis: grade.nis, nama: grade.nama, judul: grade.judul } }, user.id);
  return json({ ok: true, student: { id: target.student_id, nis: target.nis, name: target.name }, score: grade.total, status, note: grade.alasan });
}
