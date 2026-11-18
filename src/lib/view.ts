import { phase, releasedWeeks, WEEKS_PER_MONTH, type Phase } from "./schedule";

export function programState(p: { status: string; start_date: string; weeks: number; months: number }, now = Date.now()) {
  const released = p.status === "siap" ? releasedWeeks(p.start_date, p.weeks, now) : 0;
  const ph: Phase = phase(p.status, p.start_date, p.weeks, now);
  const pct = ph === "selesai" ? 100 : Math.round((released / p.weeks) * 100);
  const m = released / WEEKS_PER_MONTH;
  const monthsText = `${Number.isInteger(m) ? m : m.toFixed(1).replace(".", ",")} dari ${p.months} bulan`;
  return { released, phase: ph, pct, label: `Minggu ${released} dari ${p.weeks} · ${monthsText}` };
}
