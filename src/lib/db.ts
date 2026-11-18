import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/** Klien Neon (HTTP, tanpa koneksi persisten: cocok untuk serverless di Vercel). */
export function sql(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum diatur. Lihat README bagian Environment Variables.");
    client = neon(url);
  }
  return client;
}
