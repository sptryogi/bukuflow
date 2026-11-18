import type { Metadata } from "next";
import Link from "next/link";
import { sha256 } from "@/lib/password";
import { sql } from "@/lib/db";
import VerifyButton from "./VerifyButton";

export const metadata: Metadata = { title: "Konfirmasi Email" };
export const dynamic = "force-dynamic";

export default async function VerifikasiPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  let valid = false;
  if (/^[a-f0-9]{64}$/.test(token)) {
    const r = await sql().query(
      `SELECT 1 FROM users WHERE verify_hash = $1 AND verify_expires > now() AND status IN ('menunggu_email','menunggu_acc')`,
      [sha256(token)],
    );
    valid = r.length > 0;
  }
  return (
    <div className="auth">
      <div className="card">
        {valid ? (
          <>
            <h1>Konfirmasi email</h1>
            <p className="sub">Tekan tombol di bawah untuk mengaktifkan akun Anda.</p>
            <VerifyButton token={token} />
          </>
        ) : (
          <>
            <h1>Link tidak valid</h1>
            <p className="sub">Link ini sudah dipakai atau kedaluwarsa. Masuk dengan akun Anda untuk meminta link baru.</p>
            <Link className="btn primary" href="/login">Ke halaman masuk</Link>
          </>
        )}
      </div>
    </div>
  );
}
