import type { Metadata } from "next";
import Link from "next/link";
import RegisterForm from "./RegisterForm";
import Brand from "@/components/Logo";

export const metadata: Metadata = { title: "Daftar Guru" };

export default function DaftarPage() {
  return (
    <div className="auth">
      <div className="card">
        <Link href="/" className="back-link">← Kembali ke beranda</Link>
        <div className="auth-brand"><Brand /></div>
        <h1 style={{ fontSize: "1.5rem" }}>Daftar Guru</h1>
        <p className="sub">Buat akun untuk mengakses alokasi buku sekolah atau instansi Anda.</p>
        <RegisterForm />
        <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
