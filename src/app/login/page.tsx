import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";
import Brand from "@/components/Logo";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <div className="auth">
      <div className="card">
        <div className="auth-brand">
          <Brand />
        </div>
        <h1 style={{ fontSize: "1.5rem" }}>Masuk</h1>
        <p className="sub">Masuk untuk mengelola alokasi buku literasi.</p>
        <LoginForm />
        <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>
          Guru belum punya akun? <Link href="/daftar">Daftar di sini</Link>
        </p>
      </div>
    </div>
  );
}
