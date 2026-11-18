"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { verifyEmail } from "@/app/actions/auth";
import { Notice } from "@/components/ui";
import type { Result } from "@/lib/result";

export default function VerifyButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  return (
    <>
      {!res?.ok && (
        <button className="btn primary" style={{ width: "100%" }} disabled={pending} onClick={() => start(async () => setRes(await verifyEmail(token)))}>
          {pending ? "Memproses…" : "Konfirmasi email saya"}
        </button>
      )}
      <Notice r={res} />
      {res?.ok && <Link className="btn primary" href="/login" style={{ width: "100%" }}>Lanjut ke halaman masuk</Link>}
    </>
  );
}
