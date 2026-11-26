// Pembuat berkas hasil asesmen per murid: 4 docx (transkrip OCR, jawaban editable, penilaian pulpen merah, evaluasi) + 1 PDF ringkas.
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ASPEK_LABEL, aspekText, catatan, type AspekKey, type Key } from "./assess";
import type { GradeStored, SheetFull } from "./sheets";

export type DocInput = {
  name: string; nis: string; level: string; title: string; weekGlobal: number; date: string;
  keys: Key[]; ocrAnswers: string[]; answers: string[]; grade: GradeStored; hold: boolean; test?: boolean;
};

const RED = "D00000";
const KEYS: AspekKey[] = ["tata_bahasa", "substansi", "berpikir_kritis"];

const p = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; font?: string } = {}) =>
  new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 120 }, children: [new TextRun({ text, bold: o.bold, size: o.size ?? 22, color: o.color, italics: o.italics, font: o.font })] });

const head = (i: DocInput, judul: string): Paragraph[] => [
  p(`BukuFlow - ${judul}`, { bold: true, size: 32, after: 60 }),
  p(`${i.name} | NIS ${i.nis} | Level ${i.level}`, { bold: true, after: 40 }),
  p(`Buku: ${i.title} | Minggu ke-${i.weekGlobal} | ${i.date}${i.test ? " | DATA UJI COBA" : ""}`, { color: "555555", after: 240 }),
];

const pack = (children: Paragraph[]) => Packer.toBuffer(new Document({ sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1100, right: 1100 } } }, children }] }));

function qa(i: DocInput, answers: string[], red?: boolean): Paragraph[] {
  const out: Paragraph[] = [];
  for (const k of i.keys) {
    const a = answers[k.no - 1]?.trim() || "(kosong)";
    out.push(p(`${k.no}. ${k.question}`, { bold: true, after: 40 }));
    if (red) {
      const b = i.grade.butir[k.no - 1];
      out.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({ text: `${a}   `, size: 22 }),
            new TextRun({ text: `${b.skor}/10`, bold: true, color: RED, size: 30, font: "Segoe Script" }),
            ...(b.komentar ? [new TextRun({ text: `  ${b.komentar}${b.tahan ? " (ditahan)" : ""}`, color: RED, size: 18, italics: true })] : []),
          ],
        }),
      );
    } else out.push(p(a, { after: 160 }));
  }
  return out;
}

export const docTranskrip = (i: DocInput) => pack([...head(i, "Transkrip Asli (hasil OCR)"), p("Salinan tulisan tangan murid apa adanya oleh sistem. Tidak diubah.", { italics: true, color: "555555", after: 200 }), ...qa(i, i.ocrAnswers)]);

export const docEditable = (i: DocInput) => pack([...head(i, "Jawaban (dapat diedit)"), p("Perbaiki salah baca OCR di bawah ini. Setelah selesai, samakan jawaban di aplikasi (tombol Simpan & nilai ulang) agar penilaian ikut diperbarui.", { italics: true, color: "555555", after: 200 }), ...qa(i, i.answers)]);

export const docPenilaian = (i: DocInput) =>
  pack([
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      indent: { left: 6800 },
      spacing: { after: 160 },
      border: { top: { style: BorderStyle.SINGLE, size: 14, color: RED, space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 14, color: RED, space: 4 }, left: { style: BorderStyle.SINGLE, size: 14, color: RED, space: 8 }, right: { style: BorderStyle.SINGLE, size: 14, color: RED, space: 8 } },
      children: [new TextRun({ text: `${i.grade.total}`, bold: true, color: RED, size: 88, font: "Segoe Script" }), new TextRun({ text: " /100", bold: true, color: RED, size: 32 })],
    }),
    ...head(i, "Hasil Penilaian"),
    ...qa(i, i.answers, true),
  ]);

export function evaluasiLines(i: DocInput): { label: string; text: string }[] {
  const tahan = [...new Set(i.grade.butir.filter((b) => b.tahan).map((b) => b.no))];
  return [
    ...KEYS.map((k) => ({ label: ASPEK_LABEL[k], text: aspekText(i.grade.aspek[k]) })),
    { label: "Catatan pembacaan dan identitas", text: catatan({ registered: i.name, nis: i.nis, nama: i.grade.namaRead ?? "", nisRead: i.grade.nisRead ?? "", hold: i.hold, tahan }).join(" ") },
  ];
}

export const docEvaluasi = (i: DocInput) =>
  pack([
    ...head(i, "Lembar Evaluasi"),
    p(`Nilai total: ${i.grade.total}/100`, { bold: true, color: RED, size: 26, after: 200 }),
    ...evaluasiLines(i).flatMap((e) => [p(e.label, { bold: true, size: 24, after: 40 }), p(e.text, { after: 200 })]),
  ]);

export const safe = (s: string, n = 60) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._ -]+/g, "").trim().replace(/\s+/g, "_").slice(0, n) || "x";

export const FILE_NAMES = ["1_Transkrip_Asli_OCR.docx", "2_Jawaban_Editable.docx", "3_Penilaian.docx", "4_Evaluasi.docx"] as const;

export async function buildDocx(i: DocInput, which: 1 | 2 | 3 | 4): Promise<Uint8Array> {
  const fn = [docTranskrip, docEditable, docPenilaian, docEvaluasi][which - 1];
  return new Uint8Array(await fn(i));
}

// ---------- PDF ringkas (penilaian + evaluasi + transkrip asli) ----------
const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, "?");

export async function buildPdf(i: DocInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 50, MAXW = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const red = rgb(0.82, 0, 0), ink = rgb(0.1, 0.1, 0.1), grey = rgb(0.4, 0.4, 0.4);
  const need = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const wrap = (t: string, f: PDFFont, size: number, w: number) => {
    const lines: string[] = [];
    for (const para of ascii(t).split(/\n/)) {
      let cur = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = cur ? `${cur} ${word}` : word;
        if (f.widthOfTextAtSize(test, size) > w && cur) { lines.push(cur); cur = word; } else cur = test;
      }
      lines.push(cur);
    }
    return lines;
  };
  const text = (t: string, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) => {
    const f = o.f ?? font, size = o.size ?? 10.5, ind = o.indent ?? 0;
    for (const ln of wrap(t, f, size, MAXW - ind)) { need(size + 4); y -= size + 2; page.drawText(ln, { x: M + ind, y, size, font: f, color: o.color ?? ink }); }
    y -= o.gap ?? 6;
  };
  const title = (t: string) => { need(34); y -= 6; page.drawText(ascii(t), { x: M, y: y - 16, size: 15, font: bold, color: ink }); y -= 26; };
  const ident = () => {
    text(`${i.name} | NIS ${i.nis} | Level ${i.level}`, { f: bold, size: 11, gap: 2 });
    text(`Buku: ${i.title} | Minggu ke-${i.weekGlobal} | ${i.date}${i.test ? " | DATA UJI COBA" : ""}`, { color: grey, size: 9.5, gap: 12 });
  };

  // Halaman 1: penilaian, total besar merah di kanan atas.
  const tot = `${i.grade.total}`;
  page.drawRectangle({ x: W - M - 120, y: H - M - 52, width: 120, height: 56, borderColor: red, borderWidth: 2 });
  page.drawText(tot, { x: W - M - 112, y: H - M - 38, size: 34, font: bold, color: red });
  page.drawText("/100", { x: W - M - 112 + bold.widthOfTextAtSize(tot, 34) + 3, y: H - M - 38, size: 13, font: bold, color: red });
  title("Hasil Penilaian Asesmen Membaca");
  ident();
  y = Math.min(y, H - M - 66);
  for (const k of i.keys) {
    const b = i.grade.butir[k.no - 1];
    text(`${k.no}. ${k.question}`, { f: bold, gap: 2 });
    text(i.answers[k.no - 1]?.trim() || "(kosong)", { indent: 10, gap: 2 });
    text(`Nilai ${b.skor}/10${b.tahan ? " (ditahan)" : ""}${b.komentar ? ` - ${b.komentar}` : ""}`, { f: bold, color: red, size: 10, indent: 10, gap: 10 });
  }
  // Evaluasi
  page = pdf.addPage([W, H]); y = H - M;
  title("Lembar Evaluasi");
  ident();
  for (const e of evaluasiLines(i)) { text(e.label, { f: bold, size: 11.5, gap: 2 }); text(e.text, { gap: 12 }); }
  // Transkrip asli
  title("Transkrip Asli (hasil OCR)");
  for (const k of i.keys) { text(`${k.no}. ${i.ocrAnswers[k.no - 1]?.trim() || "(kosong)"}`, { gap: 5 }); }
  return pdf.save();
}

export function toDocInput(s: SheetFull, keys: Key[], weekOffset: number): DocInput | null {
  if (!s.grade || !s.ocr || keys.length < 10) return null;
  const d = new Date(s.updated_at.replace(" ", "T") + (/[zZ]|[+-]\d\d(:?\d\d)?$/.test(s.updated_at) ? "" : "Z"));
  return {
    name: s.name, nis: s.nis, level: s.level, title: s.title ?? "-", weekGlobal: weekOffset + s.week,
    date: d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }),
    keys, ocrAnswers: s.ocr.jawaban, answers: s.answers ?? s.ocr.jawaban, grade: s.grade, hold: s.hold, test: s.is_test,
  };
}
