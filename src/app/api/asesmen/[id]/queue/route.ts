import { after } from "next/server";
import { actor } from "@/lib/session";
import { programFor } from "@/lib/asesmen";
import { pendingCount, queueStat, retryFailed, runAndChain } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function admin(ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return { err: new Response("Unauthorized", { status: 401 }) };
  }
  if (user.role !== "admin") return { err: new Response("Forbidden", { status: 403 }) };
  const got = await programFor(user, Number((await ctx.params).id));
  if ("error" in got) return { err: new Response(got.error, { status: got.status }) };
  return { p: got.p };
}

/** Progres penilaian (khusus admin). Sekaligus menyalakan pekerja bila ada antrean yang menggantung. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await admin(ctx);
  if (a.err) return a.err;
  const week = Number(new URL(req.url).searchParams.get("week")) || 1;
  const out = await queueStat(a.p!.id, week, new URL(req.url).searchParams.get("test") === "1");
  if (out.stat.menunggu > 0 || out.stat.diproses > 0) {
    const origin = new URL(req.url).origin;
    after(async () => { if ((await pendingCount()) > 0) await runAndChain(origin); });
  }
  return Response.json(out);
}

/** Proses ulang lembar yang gagal. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await admin(ctx);
  if (a.err) return a.err;
  const week = Number(new URL(req.url).searchParams.get("week")) || 1;
  await retryFailed(a.p!.id, week, new URL(req.url).searchParams.get("test") === "1");
  const origin = new URL(req.url).origin;
  after(() => runAndChain(origin));
  return Response.json({ ok: true });
}
