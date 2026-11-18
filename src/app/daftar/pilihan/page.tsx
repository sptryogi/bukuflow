import type { Metadata } from "next";
import Link from "next/link";
import { getRegUser } from "@/lib/session";
import Choice from "./Choice";

export const metadata: Metadata = { title: "Konfirmasi Akun" };
export const dynamic = "force-dynamic";

export default async function PilihanPage() {
  const u = await getRegUser();
  return (
    <div className="auth">
      <div className="card">
        {!u ? (
          <>
            <h1>Sesi berakhir</h1>
            <p className="sub">Silakan masuk kembali untuk melanjutkan pendaftaran.</p>
            <Link className="btn primary" href="/login">Ke halaman masuk</Link>
          </>
        ) : u.status === "aktif" ? (
          <>
            <h1>Akun sudah aktif</h1>
            <p className="sub">Anda sudah dapat masuk.</p>
            <Link className="btn primary" href="/login">Ke halaman masuk</Link>
          </>
        ) : (
          <>
            <h1>Satu langkah lagi</h1>
            <p className="sub">Halo {u.name}, pendaftaran Anda tersimpan. Pilih cara mengaktifkan akun:</p>
            <Choice email={u.email} waitingAdmin={u.status === "menunggu_acc"} />
          </>
        )}
      </div>
    </div>
  );
}
