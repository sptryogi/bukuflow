import { actor } from "@/lib/session";
import { programFor } from "@/lib/asesmen";
import { deleteTestData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** Hapus semua data uji coba program ini (khusus admin). Tidak menyentuh nilai resmi. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  if (user.role !== "admin") return new Response("Forbidden", { status: 403 });
  const got = await programFor(user, Number((await ctx.params).id));
  if ("error" in got) return new Response(got.error, { status: got.status });
  return Response.json({ ok: true, deleted: await deleteTestData(got.p.id) });
}
