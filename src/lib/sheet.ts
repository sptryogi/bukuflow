// Membuat lembar asesmen per murid dari template 1 halaman: isi NIS, Nama, Tanggal; hapus kolom Kelas dan penghitung halaman.
// Hanya bergantung pada pdf-lib (bisa diuji tanpa Next). Koordinat mengikuti PDF stok asesmen (A4, 595.28 x 841.89 pt).
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const clean = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "?");

function fitSize(font: PDFFont, text: string, size: number, max: number, min = 6.5): number {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > max) s -= 0.25;
  return s;
}

export type SheetFields = { nis: string; name: string; date: string; level?: string };

export async function openTemplate(b64: string): Promise<PDFDocument> {
  return PDFDocument.load(Buffer.from(b64, "base64"));
}

export async function stampSheet(src: PDFDocument, f: SheetFields): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const [pg] = await out.copyPages(src, [0]);
  out.addPage(pg);
  const font = await out.embedFont(StandardFonts.Helvetica);
  const H = pg.getSize().height;
  const white = rgb(1, 1, 1);

  // Hapus "Kelas: ____" (label + garis) dan penghitung "n / N" di pojok kanan bawah.
  pg.drawRectangle({ x: 158, y: H - 116.8, width: 113, height: 16, color: white, borderWidth: 0 });
  pg.drawRectangle({ x: 520, y: H - 824, width: 36, height: 15, color: white, borderWidth: 0 });

  const ink = rgb(0.05, 0.1, 0.35);
  const put = (text: string, x: number, baseTop: number, maxW: number, size: number) => {
    const t = clean(text);
    pg.drawText(t, { x, y: H - baseTop, size: fitSize(font, t, size, maxW), font, color: ink });
  };
  put(f.name, 86, 88.4, 458, 11);          // garis Nama: x 84-547
  put(f.nis, 75.5, 111.4, 68, 10);          // garis NIS: x 73-146
  if (f.level) put(f.level, 315, 111.4, 59, 10); // garis Level: x 313-376
  put(f.date, 437.5, 111.4, 108, 10);       // garis Tanggal: x 436-547
  return out.save();
}