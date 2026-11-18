"use client";

import { useState } from "react";
import { changePassword, updateProfile } from "@/app/actions/account";
import { ActionForm } from "@/components/ui";
import { STATUS_LABEL, type User } from "@/lib/types";

export default function ProfileCard({ user, institution }: { user: User; institution?: string | null }) {
  const [open, setOpen] = useState<"" | "profil" | "password">("");
  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Profil</h2>
        <div className="row">
          <button className="btn sm" onClick={() => setOpen(open === "profil" ? "" : "profil")}>Ubah nama</button>
          <button className="btn sm" onClick={() => setOpen(open === "password" ? "" : "password")}>Ganti password</button>
        </div>
      </div>
      <dl className="kv" style={{ marginTop: 12 }}>
        <dt>Nama</dt><dd>{user.name}</dd>
        <dt>Email / ID</dt><dd>{user.email}</dd>
        <dt>Peran</dt><dd>{user.role === "admin" ? "Administrator" : "Guru"}</dd>
        {institution !== undefined && (<><dt>Instansi</dt><dd>{institution ?? "-"}</dd></>)}
        <dt>Status</dt><dd>{STATUS_LABEL[user.status]}</dd>
      </dl>
      {open === "profil" && (
        <div style={{ marginTop: 12 }}>
          <ActionForm action={updateProfile} onDone={() => setOpen("")}>
            <label className="f" htmlFor="pname">Nama</label>
            <input id="pname" name="name" className="input" defaultValue={user.name} required maxLength={100} />
          </ActionForm>
        </div>
      )}
      {open === "password" && (
        <div style={{ marginTop: 12 }}>
          <ActionForm action={changePassword} resetOnOk onDone={() => setTimeout(() => setOpen(""), 1500)}>
            <div className="fields">
              <div><label className="f" htmlFor="cur">Password saat ini</label><input id="cur" name="current" type="password" className="input" autoComplete="current-password" required /></div>
              <div><label className="f" htmlFor="nx">Password baru (min. 8)</label><input id="nx" name="next" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
              <div><label className="f" htmlFor="cf">Ulangi password baru</label><input id="cf" name="confirm" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
            </div>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
