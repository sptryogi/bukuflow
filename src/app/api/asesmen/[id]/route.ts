import { actor } from "@/lib/session";
import { programFor, recentDownloads, weekRows, weekSummary, windowOf } from "@/lib/asesmen";
import { programRoster } from "@/lib/q";
import { graderReady } from "@/lib/grader";
import { releasedWeeks } from "@/lib/schedule";
import { weekProgress } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** Ringkasan tab Asesmen: status tiap minggu + daftar murid untuk minggu terpilih. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const got = await programFor(user, Number((await ctx.params).id));
  if ("error" in got) return new Response(got.error, { status: got.status });
  const { p } = got;
  const admin = user.role === "admin";

  const now = Date.now();
  const released = releasedWeeks(p.start_date, p.weeks, now);
  const visible = admin ? p.weeks : released;
  const [sum, roster, w1, prog] = await Promise.all([weekSummary(p.id), programRoster(p.id), windowOf(p, 1), weekProgress(p.id)]);
  const weeks = [];
  for (let w = 1; w <= visible; w++) {
    const win = await windowOf(p, w);
    weeks.push({ week: w, global: p.week_offset + w, opens: win.opens, closes: win.closes, state: now < win.opens ? "belum" : now <= win.closes ? "buka" : "tutup", graded: sum.get(w) ?? 0, complete: prog.get(w)?.complete ?? false, pending: prog.get(w)?.pending ?? 0 });
  }
  const reqW = Number(new URL(req.url).searchParams.get("week"));
  // default: minggu terbaru yang cetaknya sudah dibuka; bila belum ada, minggu 1
  const open = weeks.filter((x) => x.state !== "belum");
  const week = Number.isInteger(reqW) && reqW >= 1 && reqW <= visible ? reqW : (open.length ? open[open.length - 1].week : 1);
  const rows = visible >= 1 ? await weekRows(p.id, week) : [];
  return Response.json({
    now,
    totalWeeks: p.weeks,
    total: roster.length,
    graderReady: graderReady(),
    settings: w1.settings,
    weeks,
    week,
    rows,
    downloads: admin ? await recentDownloads(p.id) : null,
  });
}
