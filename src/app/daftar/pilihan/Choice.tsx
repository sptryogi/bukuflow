"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { chooseAdminApproval, sendVerification } from "@/app/actions/auth";
import { Notice } from "@/components/ui";
import type { Result } from "@/lib/result";

export default function Choice({ email, waitingAdmin }: { email: string; waitingAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  const [chosen, setChosen] = useState<"" | "email" | "admin">(waitingAdmin ? "admin" : "");

  const pick = (kind: "email" | "admin") =>
    start(async () => {
      const r = await (kind === "email" ? sendVerification() : chooseAdminApproval());
      setRes(r);
      if (r.ok) setChosen(kind);
    });

  return (
    <>
      <button className="choice" disabled={pending} onClick={() => pick("email")}>
        <strong>Konfirmasi lewat email</strong>
        <span>Kami kirim link ke {email}. Setelah diklik, akun langsung aktif.</span>
      </button>
      <button className="choice" disabled={pending || chosen === "admin"} onClick={() => pick("admin")}>
        <strong>Tunggu persetujuan admin</strong>
        <span>Pendaftaran Anda masuk ke daftar admin. Anda bisa masuk setelah admin menyetujui.</span>
      </button>
      {pending && <p className="muted small">Memproses…</p>}
      <Notice r={res} />
      {chosen === "admin" && !res && <div className="notice ok">Pendaftaran Anda sudah masuk ke daftar admin. Anda bisa masuk setelah disetujui.</div>}
      {(chosen || res?.ok) && (
        <Link className="btn primary" href="/login" style={{ marginTop: 8 }}>Kembali ke halaman masuk</Link>
      )}
    </>
  );
}
