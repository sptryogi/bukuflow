import { actor } from "@/lib/session";
import { after } from "next/server";
import { programFor, weekRows, windowOf } from "@/lib/asesmen";
import { graderReady } from "@/lib/grader";
import { enqueue, runAndChain } from "@/lib/queue";
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

/** POST multipart: week, file (foto/scan 1 lembar), student (opsional). Disimpan ke antrean, dinilai di latar belakang. */
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
  if (!graderReady()) return json({ ok: false, error: "Penilaian otomatis belum aktif (DEEPSEEK_API_KEY). Isi nilai manual di tabel." }, 503);
  if (!(await throttle(`grade:${user.id}`, 800, 3600))) return json({ ok: false, error: "Terlalu banyak unggahan dalam satu jam." }, 429);

  const buf = Buffer.from(await file.arrayBuffer());
  const mt = mediaType(buf);
  if (!mt) return json({ ok: false, error: "Format harus JPG, PNG, atau WEBP." }, 415);

  let studentId: number | null = null;
  if (only) {
    const rows = await weekRows(p.id, week);
    if (!rows.some((r) => r.student_id === only && r.book_id)) return json({ ok: false, error: "Murid ini tidak punya buku di minggu tersebut." }, 400);
    studentId = only;
  }

  // Hanya disimpan; pembacaan & penilaian dikerjakan di latar belakang (lib/queue.ts).
  await enqueue({ programId: p.id, week, studentId, b64: buf.toString("base64"), mediaType: mt, label: String(fd.get("label") || file.name || "scan").slice(0, 120), userId: user.id, isTest: user.role === "admin" && fd.get("test") === "1" });
  const origin = new URL(req.url).origin;
  after(() => runAndChain(origin));
  return json({ ok: true, queued: true });
}
