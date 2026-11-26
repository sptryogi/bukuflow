import { actor } from "@/lib/session";
import { programFor, saveResult } from "@/lib/asesmen";
import { assessAnswers } from "@/lib/grader";
import { snap, total } from "@/lib/assess";
import { evaluasiLines, toDocInput } from "@/lib/docs";
import { keysOf, sheetById, updateSheet, type GradeStored } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function load(ctx: { params: Promise<{ id: string; sid: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return { err: new Response("Unauthorized", { status: 401 }) } as const;
  }
  const { id, sid } = await ctx.params;
  const got = await programFor(user, Number(id));
  if ("error" in got) return { err: new Response(got.error, { status: got.status }) } as const;
  const sheet = await sheetById(got.p.id, Number(sid));
  if (!sheet) return { err: new Response("Lembar tidak ditemukan", { status: 404 }) } as const;
  if (sheet.is_test && user.role !== "admin") return { err: new Response("Forbidden", { status: 403 }) } as const;
  return { user, p: got.p, sheet } as const;
}

/** Detail satu lembar: transkrip OCR, jawaban terkini, nilai per soal, evaluasi, dan teks soal + kunci. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; sid: string }> }) {
  const r = await load(ctx);
  if ("err" in r) return r.err;
  const { sheet, p } = r;
  const keys = sheet.book_id ? await keysOf(sheet.book_id) : [];
  const di = toDocInput(sheet, keys, p.week_offset);
  return Response.json({
    id: sheet.id, name: sheet.name, nis: sheet.nis, level: sheet.level, title: sheet.title, week: sheet.week, weekGlobal: p.week_offset + sheet.week,
    status: sheet.status, hold: sheet.hold, note: sheet.note, is_test: sheet.is_test, has_scan: sheet.has_scan, edited: !!sheet.edited_at,
    keys, ocr: sheet.ocr?.jawaban ?? [], answers: sheet.answers ?? sheet.ocr?.jawaban ?? [], grade: sheet.grade, evaluasi: di ? evaluasiLines(di) : [],
  });
}

/** Simpan hasil koreksi guru. body: { answers: string[10], regrade?: boolean, scores?: number[10], confirm?: boolean } */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; sid: string }> }) {
  const r = await load(ctx);
  if ("err" in r) return r.err;
  const { user, sheet } = r;
  if (!sheet.grade || !sheet.book_id) return Response.json({ ok: false, error: "Lembar belum dinilai." }, { status: 409 });
  let b: { answers?: unknown; regrade?: unknown; scores?: unknown; confirm?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Data tidak valid." }, { status: 400 });
  }
  if (!Array.isArray(b.answers) || b.answers.length !== 10) return Response.json({ ok: false, error: "Jawaban harus 10 butir." }, { status: 400 });
  const answers = (b.answers as unknown[]).map((x) => String(x ?? "").slice(0, 1500));
  const confirm = b.confirm === true;

  let grade: GradeStored = sheet.grade;
  let manual = false;
  if (b.regrade === true) {
    const keys = await keysOf(sheet.book_id);
    if (keys.length < 10) return Response.json({ ok: false, error: "Kunci jawaban belum ada." }, { status: 409 });
    const a = await assessAnswers(sheet.level, sheet.title ?? "", keys, answers);
    if (!a.ok) return Response.json({ ok: false, error: a.error }, { status: 502 });
    grade = { ...a.a, total: total(a.a.butir), nisRead: grade.nisRead, namaRead: grade.namaRead, judulRead: grade.judulRead };
  } else if (Array.isArray(b.scores) && b.scores.length === 10) {
    const sc = (b.scores as unknown[]).map(snap);
    manual = sc.some((v, i) => v !== grade.butir[i].skor);
    const butir = grade.butir.map((x, i) => ({ ...x, skor: sc[i], tahan: sc[i] === x.skor ? x.tahan : false }));
    grade = { ...grade, butir, total: total(butir) };
  }

  const hold = confirm ? false : sheet.hold;
  const status = confirm ? "dikonfirmasi" : sheet.status;
  await updateSheet(sheet.id, { answers, grade, status, hold, userId: user.id });
  if (!sheet.is_test && !hold) await saveResult(sheet.program_id, sheet.student_id, sheet.week, grade.total, confirm ? (manual ? "manual" : "dinilai") : status === "perlu_cek" ? "perlu_cek" : "dinilai", { butir: grade.butir, alasan: "Dikoreksi guru" }, user.id);
  return Response.json({ ok: true, total: grade.total, status, hold });
}
