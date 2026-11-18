import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, REG_COOKIE, readToken } from "./auth";
import { userById } from "./q";
import type { Role, User } from "./types";

const secret = () => process.env.SESSION_SECRET ?? "";

export async function getSessionUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const p = await readToken(token, secret());
  if (!p) return null;
  const u = await userById(Number(p[0]));
  if (!u || u.status !== "aktif" || u.role !== p[1]) return null;
  return u;
}

export const homeOf = (role: Role) => (role === "admin" ? "/admin" : "/guru");

/** Untuk halaman: arahkan ke login / beranda yang sesuai bila tidak berhak. */
export async function requireRole(role: Role): Promise<User> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== role) redirect(homeOf(u.role));
  return u;
}

/** Untuk server action dan route handler: melempar error bila tidak berhak. */
export async function actor(role?: Role): Promise<User> {
  const u = await getSessionUser();
  if (!u) throw new Error("Sesi berakhir. Silakan login ulang.");
  if (role && u.role !== role) throw new Error("Anda tidak memiliki akses.");
  return u;
}

/** Pengguna yang sedang menyelesaikan pendaftaran (cookie pendek sesudah daftar/login belum aktif). */
export async function getRegUser(): Promise<User | null> {
  const token = (await cookies()).get(REG_COOKIE)?.value;
  if (!token) return null;
  const p = await readToken(token, secret());
  return p ? await userById(Number(p[0])) : null;
}
