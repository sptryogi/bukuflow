// Tes pembuat docx/PDF + parser penilaian (tanpa jaringan/DB). Hasil contoh ditulis ke folder yang diberikan sebagai argumen.
import { writeFileSync, mkdirSync } from "node:fs";
import { parseAssessment, parseOcr, snap, aspekText, nameOk, total } from "../src/lib/assess.ts";
import { buildDocx, buildPdf, FILE_NAMES } from "../src/lib/docs.ts";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.error("GAGAL:", m); } };

ok(snap(10) === 10 && snap(7) === 5 && snap(8) === 10 && snap(2) === 0 && snap("x") === 0 && snap(3) === 5, "snap");
ok(nameOk("Khalid", "Khalid Rahman") && !nameOk("Harun", "Khalid Rahman") && nameOk("", "Siapa"), "nameOk");
const ans = ["Id, Ego, Superego", "[tidak terbaca]", "", "a", "b", "c", "d", "e", "f", "g"];
const a = parseAssessment('xx {"butir":[{"no":1,"skor":9,"komentar":"ok"},{"no":2,"skor":3},{"no":3,"skor":0}],"aspek":{"tata_bahasa":{"kuat":[],"perbaikan":[4,6,7],"tahan":[1,3],"saran":"Latih kalimat utuh."}}}', ans)!;
ok(a.butir[0].skor === 10 && a.butir[1].skor === 5 && a.butir[1].tahan && a.butir[9].skor === 0 && a.butir[9].tahan, "parse butir");
ok(a.total === 15 && total(a.butir) === 15, "total dihitung ulang");
ok(aspekText(a.aspek.tata_bahasa).startsWith("Belum ada butir dengan bukti kuat pada aspek ini. Nilai aspek ditahan; baca ulang nomor 1, 3. Fokus perbaikan nomor 4, 6, 7."), "aspekText");
ok(parseOcr('{"nis":"1","nama":"A","judul":"B","jawaban":["x"]}')!.jawaban.length === 10, "ocr 10");

const keys = Array.from({ length: 10 }, (_, i) => ({ no: i + 1, question: `Pertanyaan contoh nomor ${i + 1} tentang isi buku yang cukup panjang supaya baris membungkus ke baris berikutnya?`, expected: "x" }));
const full = parseAssessment(JSON.stringify({ butir: keys.map((k, i) => ({ no: k.no, skor: [10, 5, 0][i % 3], komentar: "Jawaban sesuai kunci", tahan: i === 1 })), aspek: { tata_bahasa: { kuat: [2], perbaikan: [4], tahan: [], saran: "Latih satu kalimat utuh." }, substansi: { kuat: [1], perbaikan: [], tahan: [2], saran: "Cari kembali tokoh." }, berpikir_kritis: { kuat: [], perbaikan: [9], tahan: [], saran: "Tulis pendapat dan alasan." } } }), ans)!;
const input = { name: "Khalid Rahman", nis: "2024001", level: "Madya", title: "Sigmund Freud", weekGlobal: 3, date: "26 Nov 2026", keys, ocrAnswers: ans.map((x) => x || ""), answers: ans.map((x) => (x ? x + " (diedit)" : "Contoh jawaban lengkap murid yang agak panjang untuk menguji pembungkusan baris pada dokumen.")), grade: { ...full, namaRead: "Harun", nisRead: "2024001" }, hold: true };
const out = process.argv[2];
if (out) mkdirSync(out, { recursive: true });
for (const n of [1, 2, 3, 4] as const) {
  const d = await buildDocx(input, n);
  ok(d.length > 2000 && d[0] === 0x50 && d[1] === 0x4b, `docx ${n}`);
  if (out) writeFileSync(`${out}/${FILE_NAMES[n - 1]}`, d);
}
const pdf = await buildPdf(input);
ok(pdf.length > 3000 && Buffer.from(pdf.slice(0, 4)).toString() === "%PDF", "pdf");
if (out) writeFileSync(`${out}/laporan.pdf`, pdf);
console.log(fail ? `${fail} tes gagal` : "Semua tes docs lulus");
process.exit(fail ? 1 : 0);
