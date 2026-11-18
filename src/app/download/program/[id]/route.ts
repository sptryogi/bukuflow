import { actor } from "@/lib/session";
import { allBooks, getInstitution, getProgram, programCells, programRoster } from "@/lib/q";
import { programState } from "@/lib/view";
import { buildResultXlsx } from "@/lib/excel";
import { buildResultPdf } from "@/lib/pdf";
import { fmtDate } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await actor();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const p = await getProgram(Number((await ctx.params).id));
  if (!p) return new Response("Program tidak ditemukan", { status: 404 });
  if (user.role === "guru" && user.institution_id !== p.institution_id) return new Response("Forbidden", { status: 403 });
  if (p.status !== "siap") return new Response("Program belum punya alokasi", { status: 409 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const st = programState(p);
  const limit = user.role === "admin" ? p.weeks : st.released;
  const upto = Math.min(Math.max(Number(url.searchParams.get("upto")) || st.released, 1), limit);
  if (limit === 0) return new Response("Belum ada minggu yang dirilis", { status: 409 });

  const [inst, roster, cells, books] = await Promise.all([getInstitution(p.institution_id), programRoster(p.id), programCells(p.id, upto), allBooks()]);
  const titleOf = new Map(books.map((b) => [b.id, b.title]));
  const cellOf = new Map(cells.map((c) => [`${c.student_id}:${c.week}`, c.book_id]));
  const grid = {
    weeks: Array.from({ length: upto }, (_, i) => p.week_offset + i + 1),
    students: roster,
    title: (sid: number, gw: number) => titleOf.get(cellOf.get(`${sid}:${gw - p.week_offset}`) ?? -1) ?? "",
  };

  const slug = (inst?.name ?? "program").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "program";
  const base = `NusaLiterasi_${slug}_Minggu${p.week_offset + upto}`;

  if (format === "pdf") {
    const pdf = await buildResultPdf(
      grid,
      "NusaLiterasi - Hasil Alokasi Buku",
      `${inst?.name ?? ""} | Program ${p.months} bulan (mulai ${fmtDate(p.start_date)}) | Minggu ke-${grid.weeks[0]} s.d. ${grid.weeks[grid.weeks.length - 1]}`,
    );
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` } });
  }
  const xlsx = await buildResultXlsx(grid);
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
}
