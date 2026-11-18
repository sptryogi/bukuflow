"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);
  return (
    <form action={formAction}>
      <label className="f" htmlFor="email">Email</label>
      <input id="email" name="email" className="input" autoComplete="username" autoCapitalize="none" autoFocus required style={{ marginBottom: 12 }} />
      <label className="f" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      {state?.error && <div className="notice err" role="alert">{state.error}</div>}
      <button className="btn primary" style={{ width: "100%", marginTop: 12 }} disabled={pending}>{pending ? "Memeriksa…" : "Masuk"}</button>
    </form>
  );
}
