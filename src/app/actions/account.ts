"use server";

import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { COOKIE, SESSION_MS, makeToken } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { stampOf, userAuthByEmail } from "@/lib/q";
import { fail, ok, refresh, run } from "@/lib/act";
import type { Result } from "@/lib/result";

export async function updateProfile(fd: FormData): Promise<Result> {
  return run(async (u) => {
    const name = String(fd.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 100) return fail("Nama wajib diisi (2-100 karakter).");
    await sql().query(`UPDATE users SET name = $2 WHERE id = $1`, [u.id, name]);
    refresh();
    return ok("Profil disimpan.");
  });
}

export async function changePassword(fd: FormData): Promise<Result> {
  return run(async (u) => {
    const cur = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (next.length < 8 || next.length > 100) return fail("Password baru minimal 8 karakter.");
    if (next !== confirm) return fail("Konfirmasi password baru tidak sama.");
    const full = await userAuthByEmail(u.email.toLowerCase());
    if (!full || !(await verifyPassword(cur, full.password_hash))) return fail("Password saat ini salah.");
    const hash = await hashPassword(next);
    await sql().query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [u.id, hash]);
    // Sesi di perangkat lain gugur; perangkat ini langsung diberi sesi baru.
    (await cookies()).set(COOKIE, await makeToken([u.id, u.role, stampOf(hash)], process.env.SESSION_SECRET ?? "", SESSION_MS), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MS / 1000,
    });
    return ok("Password berhasil diganti. Sesi di perangkat lain otomatis keluar.");
  });
}
