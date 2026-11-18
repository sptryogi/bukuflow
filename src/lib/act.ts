import { revalidatePath } from "next/cache";
import { actor } from "./session";
import type { Result } from "./result";
import type { Role, User } from "./types";

export const fail = (error: string, details?: string[]): Result => ({ ok: false, error, details });
export const ok = (message?: string, warnings?: string[]): Result => ({ ok: true, message, warnings });
export const refresh = () => revalidatePath("/", "layout");

export function toInt(v: FormDataEntryValue | null | undefined, min: number, max: number): number | null {
  const s = String(v ?? "").replace(/[.\s_]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const code = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined);

/** Membungkus action: cek login/peran, tangani error umum database. */
export async function run(fn: (u: User) => Promise<Result>, role?: Role): Promise<Result> {
  try {
    return await fn(await actor(role));
  } catch (e) {
    if (code(e) === "23505") return fail("Data dengan nama/judul/NIS yang sama sudah ada.");
    if (code(e) === "23503") return fail("Data ini masih dipakai di bagian lain sehingga tidak dapat dihapus.");
    console.error(e);
    return fail(e instanceof Error ? e.message : "Terjadi kesalahan.");
  }
}
