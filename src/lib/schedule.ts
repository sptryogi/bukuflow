// Penjadwalan mingguan (murni). Minggu mulai Senin; rilis Senin 02:00 WIB (UTC+7, tanpa DST).
export const WEEKS_PER_MONTH = 4;
const DAY = 86_400_000;

const parse = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(ymd: string, n: number): string {
  return fmt(parse(ymd) + n * DAY);
}

/** Senin pertama pada atau setelah tanggal 1 bulan tsb. month: "YYYY-MM". */
export function firstMondayOfMonth(month: string): string {
  const start = parse(`${month}-01`);
  const dow = new Date(start).getUTCDay(); // 0=Min .. 6=Sab
  const add = (8 - dow) % 7; // Senin=1
  return fmt(start + add * DAY);
}

/** Waktu rilis (ms epoch) minggu ke-`week` (1..n dalam program): Senin 02:00 WIB = Minggu 19:00 UTC sebelumnya. */
export function releaseMs(startYmd: string, week: number): number {
  return parse(startYmd) + (week - 1) * 7 * DAY - 5 * 3_600_000;
}

/** Jumlah minggu yang sudah dirilis (0..total) pada waktu `nowMs`. */
export function releasedWeeks(startYmd: string, total: number, nowMs: number): number {
  const d = nowMs - releaseMs(startYmd, 1);
  if (d < 0) return 0;
  return Math.min(total, Math.floor(d / (7 * DAY)) + 1);
}

export type Phase = "menunggu_data" | "terjadwal" | "berjalan" | "selesai";

export function phase(status: string, startYmd: string, total: number, nowMs: number): Phase {
  if (status === "menunggu_data") return "menunggu_data";
  const r = releasedWeeks(startYmd, total, nowMs);
  if (r === 0) return "terjadwal";
  if (r >= total && nowMs >= releaseMs(startYmd, total) + 7 * DAY) return "selesai";
  return "berjalan";
}

export const PHASE_LABEL: Record<Phase, string> = {
  menunggu_data: "Menunggu data murid",
  terjadwal: "Terjadwal",
  berjalan: "Berjalan",
  selesai: "Selesai",
};

export function fmtDate(ymd: string): string {
  return new Date(parse(ymd)).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function nextMonthStr(nowMs: number): string {
  const d = new Date(nowMs + 7 * 3_600_000);
  const y = d.getUTCFullYear() + (d.getUTCMonth() === 11 ? 1 : 0);
  const m = ((d.getUTCMonth() + 1) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}
