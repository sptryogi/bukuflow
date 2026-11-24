"use server";

import { headers } from "next/headers";
import { sendEmail } from "@/lib/email";
import { throttle } from "@/lib/q";

type State = { ok?: boolean; error?: string; message?: string } | null;
const TO = process.env.CONTACT_TO || "dianrakyatdigital@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendContact(_prev: State, fd: FormData): Promise<State> {
  if (String(fd.get("hp_cek") ?? "")) return { ok: true, message: "Pesan terkirim." }; // honeypot
  const name = String(fd.get("nama") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const school = String(fd.get("sekolah") ?? "").trim();
  const msg = String(fd.get("pesan") ?? "").trim();
  if (name.length < 2 || name.length > 100) return { error: "Nama wajib diisi." };
  if (!EMAIL_RE.test(email) || email.length > 160) return { error: "Format email tidak valid." };
  if (school.length < 2 || school.length > 150) return { error: "Nama sekolah wajib diisi." };
  if (msg.length < 5 || msg.length > 2000) return { error: "Pesan 5-2000 karakter." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!(await throttle(`contact:${ip}`, 5, 3600))) return { error: "Terlalu banyak pesan dari perangkat ini. Coba lagi nanti." };
  const html = `<div style="font-family:Arial,sans-serif;color:#1e293b"><h3>Pesan baru dari landing BukuFlow</h3>
<p><b>Nama:</b> ${esc(name)}<br><b>Email:</b> ${esc(email)}<br><b>Sekolah:</b> ${esc(school)}</p>
<p style="white-space:pre-wrap">${esc(msg)}</p></div>`;
  const sent = await sendEmail(TO, `Pesan BukuFlow dari ${name.slice(0, 60)}`, html);
  if (!sent.ok) return { error: "Pesan belum bisa dikirim. Silakan email langsung ke dianrakyatdigital@gmail.com." };
  return { ok: true, message: "Terima kasih, pesan Anda sudah diteruskan ke tim kami." };
}
