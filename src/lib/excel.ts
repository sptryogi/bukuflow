import ExcelJS from "exceljs";
import { LEVELS, type Level } from "./engine";

const LEVEL_LIST = LEVELS.join(",");
export const normLevel = (v: unknown): Level | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return LEVELS.find((l) => l.toLowerCase() === s) ?? null;
};

const toBuffer = async (wb: ExcelJS.Workbook): Promise<Buffer> => Buffer.from((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);

/** Template murid: Instansi, NIS, Nama Murid, Level (dropdown). */
export async function buildTemplate(institutionName: string, rows = 300): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Murid", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Instansi", key: "inst", width: 34 },
    { header: "NIS", key: "nis", width: 18 },
    { header: "Nama Murid", key: "name", width: 34 },
    { header: "Level", key: "level", width: 14 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  for (let r = 2; r <= rows + 1; r++) {
    ws.getCell(`A${r}`).value = institutionName;
    ws.getCell(`B${r}`).numFmt = "@";
    ws.getCell(`D${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${LEVEL_LIST}"`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Level tidak valid",
      error: "Pilih salah satu: Pemula, Madya, atau Mahir.",
    };
  }
  const help = wb.addWorksheet("Petunjuk");
  help.columns = [{ width: 100 }];
  [
    "PETUNJUK PENGISIAN",
    "1. Isi kolom NIS, Nama Murid, dan Level mulai baris 2 pada sheet 'Murid'. Kolom Instansi sudah terisi.",
    "2. NIS harus unik untuk setiap murid dan tidak boleh kosong (kolom NIS berformat teks agar angka 0 di depan tidak hilang).",
    "3. Level dipilih dari dropdown: Pemula, Madya, atau Mahir.",
    "4. Jangan mengubah judul kolom. Baris kosong akan diabaikan.",
    "5. Simpan sebagai .xlsx lalu unggah di halaman program.",
  ].forEach((t, i) => {
    help.getCell(`A${i + 1}`).value = t;
    if (i === 0) help.getCell("A1").font = { bold: true, size: 13 };
  });
  return toBuffer(wb);
}

export type ParsedRow = { line: number; nis: string; name: string; level: Level };

export async function parseRoster(buf: Buffer): Promise<{ rows: ParsedRow[]; errors: string[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as never);
  } catch {
    return { rows: [], errors: ["File tidak dapat dibaca. Gunakan file .xlsx dari template."] };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], errors: ["File tidak berisi sheet."] };

  const find = (names: string[]) => {
    for (let c = 1; c <= Math.max(ws.columnCount, 8); c++) {
      const t = ws.getRow(1).getCell(c).text.trim().toLowerCase();
      if (names.some((n) => t === n || t.startsWith(n))) return c;
    }
    return 0;
  };
  const cNis = find(["nis"]);
  const cName = find(["nama"]);
  const cLevel = find(["level"]);
  const missing = [!cNis && "NIS", !cName && "Nama Murid", !cLevel && "Level"].filter(Boolean);
  if (missing.length) return { rows: [], errors: [`Kolom tidak ditemukan: ${missing.join(", ")}. Gunakan template yang disediakan.`] };

  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();
  const last = Math.min(ws.rowCount, 3000);
  for (let r = 2; r <= last; r++) {
    const row = ws.getRow(r);
    const nis = row.getCell(cNis).text.trim();
    const name = row.getCell(cName).text.trim();
    const levelRaw = row.getCell(cLevel).text.trim();
    if (!nis && !name && !levelRaw) continue;
    const level = normLevel(levelRaw);
    const bad: string[] = [];
    if (!nis) bad.push("NIS kosong");
    else if (seen.has(nis)) bad.push(`NIS ${nis} ganda dengan baris ${seen.get(nis)}`);
    if (!name) bad.push("Nama kosong");
    if (!level) bad.push(levelRaw ? `Level "${levelRaw}" tidak valid` : "Level kosong");
    if (bad.length) {
      errors.push(`Baris ${r}: ${bad.join(", ")}.`);
      continue;
    }
    seen.set(nis, r);
    rows.push({ line: r, nis, name, level: level! });
  }
  if (!rows.length && !errors.length) errors.push("Tidak ada data murid di file.");
  if (rows.length > 1500) errors.push("Maksimal 1500 murid per program.");
  return { rows, errors };
}

export type GridInput = {
  weeks: number[]; // nomor minggu global yang ditampilkan
  students: { id: number; nis: string; name: string; level: string }[];
  title: (studentId: number, globalWeek: number) => string;
};

export async function buildResultXlsx(g: GridInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alokasi", { views: [{ state: "frozen", xSplit: 3, ySplit: 1 }] });
  ws.columns = [
    { header: "NIS", key: "nis", width: 16 },
    { header: "Nama Murid", key: "name", width: 30 },
    { header: "Level", key: "level", width: 12 },
    ...g.weeks.map((w) => ({ header: `Minggu ke-${w}`, key: `w${w}`, width: 34 })),
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  for (const s of g.students) {
    const row: Record<string, string> = { nis: s.nis, name: s.name, level: s.level };
    for (const w of g.weeks) row[`w${w}`] = g.title(s.id, w);
    ws.addRow(row);
  }
  ws.getColumn(1).numFmt = "@";
  return toBuffer(wb);
}
