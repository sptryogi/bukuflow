import { parseGrade, type Grade } from "./gradeParse";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export const graderReady = () => !!process.env.ANTHROPIC_API_KEY;

function prompt(title: string | null, rubric: string | null): string {
  return `Ini foto/scan satu lembar "ASESMEN MEMBACA" yang dijawab murid dengan tulisan tangan. ${title ? `Judul bukunya: "${title}".` : "Judul buku tertulis di bagian atas kertas."}
${rubric ? `\nKunci/rubrik dari guru untuk buku ini (utamakan ini):\n${rubric}\n` : ""}
Tugasmu:
1. Baca NIS, Nama, dan judul yang tertulis di bagian atas kertas.
2. Untuk setiap soal 1-10, baca jawaban tulisan tangan lalu beri skor 0-10:
   - Soal pemahaman/fakta tentang isi buku: 10 = benar dan lengkap, 5-9 = sebagian benar, 1-4 = kurang tepat tetapi masih relevan, 0 = kosong atau salah total.
   - Soal pendapat/refleksi (umumnya soal 7-10): nilai kejelasan alasan dan kaitannya dengan buku, bukan benar/salah.
   - Maafkan salah ketik dan tulisan jelek selama maksudnya terbaca.
3. Kamu tidak membaca bukunya. Nilai berdasarkan pengetahuan umum tentang tokoh/cerita tersebut dan kewajaran jawaban. Bila tidak yakin benar atau salah, beri skor menengah dan set perlu_cek=true.
4. Set perlu_cek=true bila foto buram/terpotong, NIS tidak terbaca, ${title ? `judul di kertas berbeda dari "${title}", ` : ""}atau ada soal yang tidak dapat dibaca. Jelaskan singkat di "alasan".

Balas HANYA JSON, tanpa teks lain, dengan bentuk:
{"nis":"","nama":"","judul":"","soal":[{"no":1,"skor":0,"ringkas":"isi jawaban dalam <=12 kata"}],"perlu_cek":false,"alasan":""}`;
}

export type GradeOutcome = { ok: true; grade: Grade } | { ok: false; error: string };

export async function gradeScan(image: Buffer, mediaType: string, title: string | null, rubric: string | null): Promise<GradeOutcome> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Penilaian otomatis belum aktif (ANTHROPIC_API_KEY belum diisi di Vercel). Nilai tetap bisa diisi manual." };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1800,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
              { type: "text", text: prompt(title, rubric) },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("Grader gagal:", res.status, (await res.text()).slice(0, 300));
      return { ok: false, error: res.status === 429 ? "Layanan penilai sedang sibuk. Coba lagi sebentar." : "Layanan penilai gagal merespons." };
    }
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const grade = parseGrade(text);
    return grade ? { ok: true, grade } : { ok: false, error: "Hasil baca foto tidak dapat dipahami. Coba foto ulang lebih jelas." };
  } catch (e) {
    console.error("Grader error:", e);
    return { ok: false, error: "Tidak dapat menghubungi layanan penilai." };
  }
}
