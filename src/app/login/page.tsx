import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <div className="auth">
      <div className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <span className="logo">N</span>
          <div><strong>NusaLiterasi</strong><div className="muted small">Alokasi Buku Literasi</div></div>
        </div>
        <LoginForm />
        <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>
          Guru belum punya akun? <Link href="/daftar">Daftar di sini</Link>
        </p>
      </div>
    </div>
  );
}
