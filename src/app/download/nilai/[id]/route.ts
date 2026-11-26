import { actor } from "@/lib/session";
import { allScores, programFor } from "@/lib/asesmen";
import { getInstitution, programRoster } from "@/lib/q";
import { buildResultXlsx } from "@/lib/excel";
import { buildResultPdf } from "@/lib/pdf";
import { fmtDate } from "@/lib/schedule";
import { weekProgress } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Riwayat nilai: NIS, Nama Murid, Level, lalu satu kolom per minggu yang sudah punya nilai. ?format=xlsx|pdf */
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
  const [inst, roster, scores] = await Promise.all([getInstitution(p.institution_id), programRoster(p.id), allScores(p.id)]);
  const prog = await weekProgress(p.id);
  const force = user.role === "admin" && new URL(req.url).searchParams.get("force") === "1";
  // Excel hanya memuat minggu yang SEMUA muridnya sudah selesai dinilai (admin boleh memaksa untuk pengecekan).
  const weeks = [...new Set([...scores.keys()].map((k) => Number(k.split(":")[1])))].filter((w) => force || prog.get(w)?.complete).sort((a, b) => a - b);
  if (!weeks.length) return new Response("Unduhan nilai terbuka setelah SEMUA murid pada satu minggu selesai dinilai.", { status: 409 });

  const grid = {
    weeks: weeks.map((w) => p.week_offset + w),
    students: roster,
    title: (sid: number, gw: number) => {
      const v = scores.get(`${sid}:${gw - p.week_offset}`);
      return v === undefined ? "" : String(v);
    },
  };
  const slug = (inst?.name ?? "program").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "program";
  const base = `BukuFlow_Nilai_${slug}_Minggu${grid.weeks[grid.weeks.length - 1]}`;
  const format = new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  if (format === "pdf") {
    const pdf = await buildResultPdf(grid, "BukuFlow - Riwayat Nilai Asesmen", `${inst?.name ?? ""} | Program ${p.months} bulan (mulai ${fmtDate(p.start_date)}) | Minggu ke-${grid.weeks[0]} s.d. ${grid.weeks[grid.weeks.length - 1]}`);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` } });
  }
  const xlsx = await buildResultXlsx(grid, { sheet: "Nilai", numeric: true, weekWidth: 14 });
  return new Response(new Uint8Array(xlsx), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` } });
}
