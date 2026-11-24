import { after } from "next/server";
import { runAndChain } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Memicu pekerja antrean penilaian (dipakai penyambung otomatis & cron harian). Aman tanpa login:
// hanya memproses antrean yang sudah ada, dan hanya satu pekerja berjalan sekaligus.
async function kick(req: Request) {
  const origin = new URL(req.url).origin;
  after(() => runAndChain(origin));
  return Response.json({ ok: true }, { status: 202 });
}
export const POST = kick;
export const GET = kick;
