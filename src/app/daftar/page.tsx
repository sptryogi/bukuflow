import type { Metadata } from "next";
import Link from "next/link";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Daftar Guru" };

export default function DaftarPage() {
  return (
    <div className="auth">
      <div className="card">
        <h1>Daftar Guru</h1>
        <p className="sub">Buat akun untuk mengakses alokasi buku sekolah atau instansi Anda.</p>
        <RegisterForm />
        <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
