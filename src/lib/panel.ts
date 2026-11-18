import { allBooks, institutionPrograms, programCells, programRoster } from "./q";
import { programState } from "./view";
import { fmtDate } from "./schedule";
import type { PanelProps } from "@/components/ProgramPanel";
import type { Program } from "./types";

export async function loadPanel(
  p: Program,
  role: "admin" | "guru",
  institution: { id: number; name: string },
  initial?: { tab?: string; week?: number },
): Promise<PanelProps> {
  const st = programState(p);
  const [roster, books, siblings] = await Promise.all([programRoster(p.id), allBooks(), institutionPrograms(p.institution_id)]);
  // guru hanya menerima alokasi minggu yang sudah dirilis
  const cells = role === "guru" && st.released === 0 ? [] : await programCells(p.id, role === "guru" ? st.released : undefined);
  const used = new Set(cells.map((c) => c.book_id));
  const titles: Record<number, string> = {};
  for (const b of books) if (used.has(b.id)) titles[b.id] = b.title;
  const from = siblings.find((s) => s.id !== p.id && s.students > 0);
  const tabs = ["saat_ini", "tabel", "minggu", "unduh", "murid"];
  return {
    role,
    program: { id: p.id, months: p.months, weeks: p.weeks, start_date: p.start_date, week_offset: p.week_offset, status: p.status, alloc_error: p.alloc_error },
    institution,
    released: st.released,
    phase: st.phase,
    pct: st.pct,
    label: st.label,
    roster,
    cells,
    titles,
    copyFrom: from ? { id: from.id, label: `program ${from.months} bulan (mulai ${fmtDate(from.start_date)})` } : null,
    initialTab: tabs.includes(initial?.tab ?? "") ? (initial!.tab as PanelProps["initialTab"]) : undefined,
    initialWeek: initial?.week,
  };
}
