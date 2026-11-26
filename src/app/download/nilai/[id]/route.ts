import { actor } from "@/lib/session";
import { allScores, programFor } from "@/lib/asesmen";
import { getInstitution, programRoster } from "@/lib/q";
import { buildResultXlsx, type GridInput } from "@/lib/excel";
import { buildResultPdf } from "@/lib/pdf";
import { fmtDate, phase } from "@/lib/schedule";
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
  const u = new URL(req.url);
  const only = Number(u.searchParams.get("week")) || 0; // rekap satu minggu (nomor lokal 1..n)
  const akhir = u.searchParams.get("scope") === "akhir"; // rekap akhir program (+ kolom rata-rata)
  // Realtime: memuat semua nilai yang SUDAH masuk, walau belum semua murid selesai. Yang belum selesai diberi label "Sementara".
  const scored = [...new Set([...scores.keys()].map((k) => Number(k.split(":")[1])))].sort((a, b) => a - b);
  const weeks = only ? scored.filter((w) => w === only) : scored;
  if (!weeks.length) return new Response("Belum ada nilai yang masuk.", { status: 409 });
  const partial = weeks.some((w) => !prog.get(w)?.complete) || (akhir && phase(p.status, p.start_date, p.weeks, Date.now()) !== "selesai");

  const grid: GridInput = {
    weeks: weeks.map((w) => p.week_offset + w),
    students: roster,
    title: (sid: number, gw: number) => {
      const v = scores.get(`${sid}:${gw - p.week_offset}`);
      return v === undefined ? "" : String(v);
    },
  };
  if (akhir) {
    grid.avg = (sid: number) => {
      const v = weeks.map((w) => scores.get(`${sid}:${w}`)).filter((x): x is number => x !== undefined);
      return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "";
    };
  }
  const slug = (inst?.name ?? "program").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "program";
  const tag = akhir ? "RekapAkhir" : only ? `Nilai_Minggu${p.week_offset + only}` : "Nilai";
  const base = `BukuFlow_${tag}_${slug}${partial ? "_SEMENTARA" : ""}`;
  const heading = `BukuFlow - ${akhir ? "Rekap Akhir Program" : only ? `Rekap Nilai Minggu ke-${p.week_offset + only}` : "Riwayat Nilai Asesmen"}${partial ? " (SEMENTARA)" : ""}`;
  const format = u.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  if (format === "pdf") {
    const done = only ? prog.get(only) : null;
    const pdf = await buildResultPdf(grid, heading, `${inst?.name ?? ""} | Program ${p.months} bulan (mulai ${fmtDate(p.start_date)}) | Minggu ke-${grid.weeks[0]} s.d. ${grid.weeks[grid.weeks.length - 1]}${done ? ` | ${done.done}/${done.total} murid dinilai` : ""}`);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` } });
  }
  const xlsx = await buildResultXlsx(grid, { sheet: partial ? "Nilai (sementara)" : "Nilai", numeric: true, weekWidth: 14 });
  return new Response(new Uint8Array(xlsx), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` } });
}
