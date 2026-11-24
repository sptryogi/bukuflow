import { Zip, ZipPassThrough } from "fflate";
import { actor } from "@/lib/session";
import { logDownload, programFor, templateB64s, weekRows, windowOf } from "@/lib/asesmen";
import { openTemplate, stampSheet } from "@/lib/sheet";
import { getInstitution } from "@/lib/q";
import { dayName, fmtDate, sheetDate } from "@/lib/schedule";
import type { PDFDocument } from "pdf-lib";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const safe = (s: string, n = 40) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, n) || "x";

/** GET ?week=N[&student=ID]: ZIP berisi 1 PDF per murid (atau 1 PDF bila student diisi). Guru: mulai hari buka cetak; admin kapan saja. */
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

  const url = new URL(req.url);
  const week = Number(url.searchParams.get("week"));
  if (!Number.isInteger(week) || week < 1 || week > p.weeks) return new Response("Minggu tidak valid", { status: 400 });
  const w = await windowOf(p, week);
  if (user.role === "guru" && Date.now() < w.opens) {
    const d = new Date(w.opens + 7 * 3_600_000).toISOString().slice(0, 10);
    return new Response(`Asesmen minggu ini baru bisa dicetak ${dayName(d)} ${fmtDate(d)} pukul 02.00 WIB.`, { status: 403 });
  }

  const only = Number(url.searchParams.get("student")) || null;
  const rows = (await weekRows(p.id, week)).filter((r) => (only ? r.student_id === only : true));
  const tpls = await templateB64s([...new Set(rows.map((r) => r.book_id).filter((x): x is number => !!x))]);
  const docs = new Map<number, PDFDocument>();
  const date = sheetDate(Date.now());
  const inst = await getInstitution(p.institution_id);
  const gw = p.week_offset + week;
  const base = `BukuFlow_Asesmen_${safe(inst?.name ?? "program")}_Minggu${gw}`;

  const missing: string[] = [];
  const files: { name: string; data: Uint8Array }[] = [];
  for (const r of rows) {
    const b64 = r.book_id ? tpls.get(r.book_id) : undefined;
    if (!b64) {
      missing.push(`${r.nis} - ${r.name}: ${r.title ?? "(belum ada buku)"}`);
      continue;
    }
    let src = docs.get(r.book_id!);
    if (!src) docs.set(r.book_id!, (src = await openTemplate(b64)));
    files.push({ name: `${safe(r.nis, 20)}_${safe(r.name)}_Minggu${gw}.pdf`, data: await stampSheet(src, { nis: r.nis, name: r.name, date }) });
  }
  if (!files.length) return new Response(only ? "Template asesmen untuk judul murid ini belum tersedia." : "Belum ada template asesmen untuk judul minggu ini.", { status: 404 });

  await logDownload(p.id, week, user.id, only ? "satu" : "zip", files.length);

  if (only) return new Response(new Uint8Array(files[0].data), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${files[0].name}"` } });

  if (missing.length) files.push({ name: "CATATAN_tanpa_template.txt", data: new TextEncoder().encode("Murid berikut belum bisa dibuatkan lembar karena template asesmen judulnya belum tersedia:\n\n" + missing.join("\n") + "\n") });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      for (const f of files) {
        const e = new ZipPassThrough(f.name);
        zip.add(e);
        e.push(f.data, true);
      }
      zip.end();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"`, "Cache-Control": "no-store" } });
}
