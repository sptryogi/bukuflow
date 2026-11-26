import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { GridInput } from "./excel";

const clean = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

function fit(font: PDFFont, text: string, size: number, max: number): string {
  const t = clean(text);
  if (font.widthOfTextAtSize(t, size) <= max) return t;
  let s = t;
  while (s.length > 1 && font.widthOfTextAtSize(s + "...", size) > max) s = s.slice(0, -1);
  return s + "...";
}

/** PDF landscape A4: tabel dipecah per 4 kolom minggu supaya tetap terbaca. */
export async function buildResultPdf(g: GridInput, heading: string, sub: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 32, RH = 17, PER = 4;
  const fixed = g.avg ? [64, 150, 46, 52] : [64, 150, 46];
  const weekW = (W - 2 * M - fixed.reduce((a, b) => a + b, 0)) / PER;

  const chunks: number[][] = [];
  for (let i = 0; i < g.weeks.length; i += PER) chunks.push(g.weeks.slice(i, i + PER));
  if (!chunks.length) chunks.push([]);

  let page = pdf.addPage([W, H]);
  let y = H - M;
  const header = (weeks: number[]) => {
    page.drawText(clean(heading), { x: M, y: y - 4, size: 14, font: bold, color: rgb(0.06, 0.46, 0.43) });
    page.drawText(clean(sub), { x: M, y: y - 20, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 40;
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: RH, color: rgb(0.88, 0.95, 0.94) });
    let x = M + 3;
    (g.avg ? ["NIS", "Nama Murid", "Level", "Rata-rata"] : ["NIS", "Nama Murid", "Level"]).forEach((t, i) => {
      page.drawText(t, { x, y, size: 8.5, font: bold });
      x += fixed[i];
    });
    weeks.forEach((w) => {
      page.drawText(`Minggu ke-${w}`, { x, y, size: 8.5, font: bold });
      x += weekW;
    });
    y -= RH;
  };

  chunks.forEach((weeks, ci) => {
    if (ci > 0) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
    header(weeks);
    g.students.forEach((s, idx) => {
      if (y < M + RH) {
        page = pdf.addPage([W, H]);
        y = H - M;
        header(weeks);
      }
      if (idx % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: RH, color: rgb(0.97, 0.98, 0.98) });
      let x = M + 3;
      (g.avg ? [s.nis, s.name, s.level, g.avg(s.id) || "-"] : [s.nis, s.name, s.level]).forEach((t, i) => {
        page.drawText(fit(font, t, 8, fixed[i] - 6), { x, y, size: 8, font });
        x += fixed[i];
      });
      weeks.forEach((w) => {
        page.drawText(fit(font, g.title(s.id, w) || "-", 8, weekW - 6), { x, y, size: 8, font });
        x += weekW;
      });
      y -= RH;
    });
  });
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`Halaman ${i + 1}/${pages.length}`, { x: W - M - 60, y: 14, size: 8, font, color: rgb(0.5, 0.5, 0.5) }));
  return Buffer.from(await pdf.save());
}
