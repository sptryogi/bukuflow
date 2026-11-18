"use client";

import { useActionState } from "react";
import { register } from "@/app/actions/auth";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, null);
  return (
    <form action={formAction}>
      <div className="fields" style={{ gridTemplateColumns: "1fr" }}>
        <div><label className="f" htmlFor="name">Nama</label><input id="name" name="name" className="input" autoComplete="name" required maxLength={100} /></div>
        <div><label className="f" htmlFor="school">Nama sekolah / instansi</label><input id="school" name="school" className="input" required maxLength={150} /></div>
        <div><label className="f" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" autoComplete="email" required maxLength={160} /></div>
        <div><label className="f" htmlFor="password">Password (min. 8 karakter)</label><input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
        <div><label className="f" htmlFor="confirm">Konfirmasi password</label><input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
      </div>
      {state?.error && <div className="notice err" role="alert">{state.error}</div>}
      <button className="btn primary" style={{ width: "100%", marginTop: 8 }} disabled={pending}>{pending ? "Mendaftar…" : "Daftar"}</button>
    </form>
  );
}
