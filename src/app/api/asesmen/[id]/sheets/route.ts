import { actor } from "@/lib/session";
import { programFor } from "@/lib/asesmen";
import { sheetsOfWeek } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** Daftar lembar (folder asli + hasil penilaian) satu minggu. ?week=&test=1 (data uji hanya admin). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const got = await programFor(user, Number((await ctx.params).id));
  if ("error" in got) return new Response(got.error, { status: got.status });
  const url = new URL(req.url);
  const test = url.searchParams.get("test") === "1";
  if (test && user.role !== "admin") return new Response("Forbidden", { status: 403 });
  const week = Number(url.searchParams.get("week")) || 1;
  const rows = await sheetsOfWeek(got.p.id, week, test);
  return Response.json(
    rows.map((s) => ({
      id: s.id, student_id: s.student_id, nis: s.nis, name: s.name, level: s.level, title: s.title, status: s.status, hold: s.hold,
      total: s.grade?.total ?? null, edited: !!s.edited_at, has_scan: s.has_scan, note: s.note,
    })),
  );
}
