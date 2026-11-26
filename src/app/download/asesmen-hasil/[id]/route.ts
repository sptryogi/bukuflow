import { Zip, ZipPassThrough } from "fflate";
import { actor } from "@/lib/session";
import { getInstitution } from "@/lib/q";
import { programFor } from "@/lib/asesmen";
import { buildDocx, buildPdf, FILE_NAMES, safe, toDocInput } from "@/lib/docs";
import { keysOf, scanOf, sheetById, sheetsOfWeek, type SheetFull } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Unduhan hasil asesmen.
 *  ?week=N&kind=semua|asli|hasil|pdf [&level=Pemula|Madya|Mahir] [&test=1]  -> ZIP
 *     asli  : Folder_Asli/<Level>/<Nama>.jpg
 *     hasil : Hasil_Penilaian/<Level>/<Nama>/{1_Transkrip_Asli_OCR,2_Jawaban_Editable,3_Penilaian,4_Evaluasi}.docx
 *     pdf   : Hasil_PDF/<Level>/<Nama>.pdf   (1 PDF per murid)
 *     semua : asli + hasil
 *  ?sheet=ID&file=1|2|3|4|pdf|scan  -> satu berkas
 */
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
  const u = new URL(req.url);
  const test = u.searchParams.get("test") === "1";
  if (test && user.role !== "admin") return new Response("Forbidden", { status: 403 });
  const inst = await getInstitution(p.institution_id);
  const keyCache = new Map<number, Awaited<ReturnType<typeof keysOf>>>();
  const keysFor = async (bookId: number | null) => {
    if (!bookId) return [];
    if (!keyCache.has(bookId)) keyCache.set(bookId, await keysOf(bookId));
    return keyCache.get(bookId)!;
  };
  const dl = (data: Uint8Array, name: string, type: string) => new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });

  // ---- satu berkas ----
  const sid = Number(u.searchParams.get("sheet"));
  if (sid) {
    const s = await sheetById(p.id, sid);
    if (!s || (s.is_test && user.role !== "admin")) return new Response("Tidak ditemukan", { status: 404 });
    const file = u.searchParams.get("file") ?? "pdf";
    const base = `${safe(s.name)}_Minggu${p.week_offset + s.week}`;
    if (file === "scan") {
      const sc = await scanOf(p.id, s.id);
      return sc ? dl(new Uint8Array(Buffer.from(sc.b64, "base64")), `${base}_asli.${EXT[sc.type] ?? "jpg"}`, sc.type) : new Response("Scan tidak ada", { status: 404 });
    }
    const di = toDocInput(s, await keysFor(s.book_id), p.week_offset);
    if (!di) return new Response("Lembar belum dinilai / kunci belum ada.", { status: 409 });
    if (file === "pdf") return dl(await buildPdf(di), `${base}.pdf`, "application/pdf");
    const n = Number(file);
    if (![1, 2, 3, 4].includes(n)) return new Response("Berkas tidak dikenal", { status: 400 });
    return dl(await buildDocx(di, n as 1 | 2 | 3 | 4), `${safe(s.name)}_${FILE_NAMES[n - 1]}`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }

  // ---- ZIP ----
  const week = Number(u.searchParams.get("week"));
  if (!Number.isInteger(week) || week < 1 || week > p.weeks) return new Response("Minggu tidak valid", { status: 400 });
  const kind = ["semua", "asli", "hasil", "pdf"].includes(u.searchParams.get("kind") ?? "") ? u.searchParams.get("kind")! : "semua";
  const level = ["Pemula", "Madya", "Mahir"].includes(u.searchParams.get("level") ?? "") ? u.searchParams.get("level") : null;
  const sheets: SheetFull[] = (await sheetsOfWeek(p.id, week, test)).filter((s) => !level || s.level === level);
  if (!sheets.length) return new Response("Belum ada lembar yang dinilai untuk pilihan ini.", { status: 404 });

  // Nama folder murid unik per level (bila kembar, tambahkan NIS).
  const seen = new Set<string>();
  const label = new Map<number, string>();
  for (const s of sheets) {
    let n = safe(s.name);
    if (seen.has(`${s.level}/${n}`)) n = `${n}_${safe(s.nis, 20)}`;
    seen.add(`${s.level}/${n}`);
    label.set(s.id, n);
  }
  const root = `BukuFlow_${test ? "UJI_" : ""}${safe(inst?.name ?? "program", 30)}_Minggu${p.week_offset + week}${level ? `_${level}` : ""}_${kind}`;
  const withAsli = kind === "asli" || kind === "semua";
  const withHasil = kind === "hasil" || kind === "semua";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      const add = (name: string, data: Uint8Array) => {
        const e = new ZipPassThrough(name);
        zip.add(e);
        e.push(data, true);
      };
      try {
        const skipped: string[] = [];
        for (const s of sheets) {
          const nm = label.get(s.id)!;
          if (withAsli) {
            const sc = await scanOf(p.id, s.id);
            if (sc) add(`Folder_Asli/${s.level}/${nm}.${EXT[sc.type] ?? "jpg"}`, new Uint8Array(Buffer.from(sc.b64, "base64")));
          }
          if (withHasil || kind === "pdf") {
            const di = toDocInput(s, await keysFor(s.book_id), p.week_offset);
            if (!di) { skipped.push(`${s.name}: belum dinilai / kunci belum ada`); continue; }
            if (withHasil) {
              const docs = await Promise.all(([1, 2, 3, 4] as const).map((n) => buildDocx(di, n)));
              docs.forEach((d, i) => add(`Hasil_Penilaian/${s.level}/${nm}/${FILE_NAMES[i]}`, d));
            }
            if (kind === "pdf") add(`Hasil_PDF/${s.level}/${nm}.pdf`, await buildPdf(di));
          }
        }
        if (skipped.length) add("CATATAN.txt", new TextEncoder().encode("Tidak disertakan:\n" + skipped.join("\n") + "\n"));
        zip.end();
      } catch (e) {
        console.error("ZIP hasil gagal:", e);
        controller.error(e);
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${root}.zip"`, "Cache-Control": "no-store" } });
}
