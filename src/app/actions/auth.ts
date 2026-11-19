"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { COOKIE, REG_COOKIE, REG_MS, SESSION_MS, makeToken } from "@/lib/auth";
import { equalSecret, hashPassword, newToken, sha256, verifyPassword } from "@/lib/password";
import { findOrCreateInstitution, throttle, userAuthByEmail } from "@/lib/q";
import { sendEmail, verifyEmailHtml } from "@/lib/email";
import { getRegUser, homeOf } from "@/lib/session";
import { fail, ok } from "@/lib/act";
import type { Result } from "@/lib/result";

type FormState = { error?: string } | null;
const secret = () => process.env.SESSION_SECRET ?? "";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

async function setCookie(name: string, value: string, maxAgeMs: number) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs / 1000,
  });
}

/** Akun admin dibuat dari ADMIN_EMAIL/ADMIN_PASSWORD saat login pertama (bila belum ada admin). */
async function ensureAdmin(id: string, pw: string) {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const pass = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !pass || id !== email || !equalSecret(pw, pass)) return;
  const has = await sql().query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
  if (has.length) return;
  await sql().query(
    `INSERT INTO users (name, email, password_hash, role, status, approved_via, approved_at)
     VALUES ('Admin', $1, $2, 'admin', 'aktif', 'admin', now()) ON CONFLICT DO NOTHING`,
    [email, await hashPassword(pass)],
  );
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("email") ?? "").trim().toLowerCase();
  const pw = String(fd.get("password") ?? "");
  if (!id || !pw) return { error: "Isi email dan password." };
  if (!(await throttle(`login-ip:${await clientIp()}`, 40, 900)) || !(await throttle(`login:${id}`, 8, 900))) {
    return { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };
  }
  await ensureAdmin(id, pw);
  const u = await userAuthByEmail(id);
  if (!u || !(await verifyPassword(pw, u.password_hash))) {
    await delay(600);
    return { error: "Email atau password salah." };
  }
  if (u.status !== "aktif") {
    if (u.status === "ditolak") return { error: "Pendaftaran Anda tidak disetujui. Silakan hubungi admin." };
    await setCookie(REG_COOKIE, await makeToken([u.id], secret(), REG_MS), REG_MS);
    redirect("/daftar/pilihan");
  }
  await setCookie(COOKIE, await makeToken([u.id, u.role], secret(), SESSION_MS), SESSION_MS);
  redirect(homeOf(u.role));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

export async function register(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get("name") ?? "").trim();
  const school = String(fd.get("school") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const pw = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (name.length < 2 || name.length > 100) return { error: "Nama wajib diisi (2-100 karakter)." };
  if (school.length < 2 || school.length > 150) return { error: "Nama sekolah / instansi wajib diisi." };
  if (!EMAIL_RE.test(email) || email.length > 160) return { error: "Format email tidak valid." };
  if (pw.length < 8) return { error: "Password minimal 8 karakter." };
  if (pw.length > 100) return { error: "Password terlalu panjang." };
  if (pw !== confirm) return { error: "Konfirmasi password tidak sama." };
  if (!(await throttle(`reg:${await clientIp()}`, 6, 3600))) return { error: "Terlalu banyak pendaftaran dari perangkat ini. Coba lagi nanti." };

  const exists = await sql().query(`SELECT 1 FROM users WHERE lower(email) = $1`, [email]);
  if (exists.length) return { error: "Email sudah terdaftar. Silakan masuk." };

  const inst = await findOrCreateInstitution(school);
  const hash = await hashPassword(pw);
  let id: number;
  try {
    const r = await sql().query(
      `INSERT INTO users (name, email, password_hash, role, status, institution_id, school_name)
       VALUES ($1, $2, $3, 'guru', 'menunggu_email', $4, $5) RETURNING id`,
      [name, email, hash, inst, school],
    );
    id = r[0].id as number;
  } catch {
    return { error: "Email sudah terdaftar. Silakan masuk." };
  }
  await setCookie(REG_COOKIE, await makeToken([id], secret(), REG_MS), REG_MS);
  redirect("/daftar/pilihan");
}

async function baseUrl(): Promise<string> {
  const env = (process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  if (env) return env;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** Pilihan 1: kirim link konfirmasi ke email. */
export async function sendVerification(): Promise<Result> {
  const u = await getRegUser();
  if (!u || u.role !== "guru") return fail("Sesi pendaftaran berakhir. Silakan masuk kembali.");
  if (u.status === "aktif") return ok("Akun sudah aktif. Silakan masuk.");
  if (u.status === "ditolak") return fail("Pendaftaran Anda tidak disetujui.");
  if (!(await throttle(`verify:${u.id}`, 3, 3600))) return fail("Terlalu sering meminta email. Coba lagi dalam satu jam.");

  const raw = newToken();
  await sql().query(`UPDATE users SET verify_hash = $2, verify_expires = now() + interval '24 hours' WHERE id = $1`, [u.id, sha256(raw)]);
  const link = `${await baseUrl()}/verifikasi?token=${raw}`;
  const sent = await sendEmail(u.email, "Konfirmasi email BukuFlow", verifyEmailHtml(u.name, link));
  if (!sent.ok) return fail(sent.error);
  return ok(`Link konfirmasi sudah dikirim ke ${u.email}. Cek kotak masuk (dan folder spam), lalu klik tombolnya.`);
}

/** Pilihan 2: menunggu persetujuan admin. */
export async function chooseAdminApproval(): Promise<Result> {
  const u = await getRegUser();
  if (!u || u.role !== "guru") return fail("Sesi pendaftaran berakhir. Silakan masuk kembali.");
  await sql().query(`UPDATE users SET status = 'menunggu_acc' WHERE id = $1 AND status = 'menunggu_email'`, [u.id]);
  return ok("Pendaftaran Anda sudah masuk ke daftar admin. Anda bisa masuk setelah disetujui.");
}

export async function verifyEmail(token: string): Promise<Result> {
  if (!/^[a-f0-9]{64}$/.test(token)) return fail("Link tidak valid.");
  const r = await sql().query(
    `UPDATE users SET status = 'aktif', approved_via = 'email', approved_at = now(), verify_hash = NULL, verify_expires = NULL
     WHERE verify_hash = $1 AND verify_expires > now() AND status IN ('menunggu_email', 'menunggu_acc') RETURNING id`,
    [sha256(token)],
  );
  if (!r.length) return fail("Link tidak valid atau sudah kedaluwarsa. Silakan minta link baru dari halaman pendaftaran.");
  return ok("Email berhasil dikonfirmasi. Akun Anda sudah aktif.");
}
