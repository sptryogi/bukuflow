import { actor } from "@/lib/session";
import { programFor } from "@/lib/asesmen";
import { scanOf, sheetById } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** Gambar scan asli lembar (untuk ditampilkan berdampingan dengan hasil). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; sid: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id, sid } = await ctx.params;
  const got = await programFor(user, Number(id));
  if ("error" in got) return new Response(got.error, { status: got.status });
  const sheet = await sheetById(got.p.id, Number(sid));
  if (!sheet || (sheet.is_test && user.role !== "admin")) return new Response("Tidak ditemukan", { status: 404 });
  const sc = await scanOf(got.p.id, sheet.id);
  if (!sc) return new Response("Scan tidak ada", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(sc.b64, "base64")), { headers: { "Content-Type": sc.type, "Cache-Control": "private, max-age=300" } });
}
