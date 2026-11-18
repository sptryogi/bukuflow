"use client";

import { useState } from "react";
import { approveUser, rejectUser, setUserInstitution } from "@/app/actions/admin";
import { Notice, RunButton } from "@/components/ui";
import { STATUS_LABEL, type User } from "@/lib/types";
import type { Result } from "@/lib/result";

type G = User & { institution_name: string | null };
const cls = (s: string) => (s === "aktif" ? "ok" : s === "ditolak" ? "bad" : "warn");

export default function GuruTable({ gurus, institutions, showInstitution = true }: { gurus: G[]; institutions: { id: number; name: string }[]; showInstitution?: boolean }) {
  const [f, setF] = useState<"semua" | "menunggu" | "aktif" | "ditolak">("semua");
  const [notice, setNotice] = useState<Result | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const shown = gurus.filter((g) => f === "semua" || (f === "menunggu" ? g.status.startsWith("menunggu") : g.status === f));
  const pending = gurus.filter((g) => g.status.startsWith("menunggu")).length;

  return (
    <>
      <div className="chips" style={{ marginBottom: 10 }}>
        {([["semua", "Semua"], ["menunggu", `Menunggu (${pending})`], ["aktif", "Aktif"], ["ditolak", "Ditolak"]] as const).map(([k, l]) => (
          <button key={k} className={`chip ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      <Notice r={notice} />
      <div className="tablewrap">
        <table className="rtable">
          <thead>
            <tr><th>Nama</th><th>Email</th>{showInstitution && <th>Instansi</th>}<th>Status</th><th>Daftar</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <tr key={g.id}>
                <td data-label="Nama"><strong>{g.name}</strong></td>
                <td data-label="Email">{g.email}</td>
                {showInstitution && (
                  <td data-label="Instansi">
                    <select
                      className="input"
                      style={{ minHeight: 34, padding: "4px 8px", fontSize: 14 }}
                      value={g.institution_id ?? ""}
                      disabled={busy === g.id}
                      title={g.school_name ? `Ditulis saat daftar: ${g.school_name}` : undefined}
                      onChange={async (e) => { setBusy(g.id); setNotice(await setUserInstitution(g.id, Number(e.target.value))); setBusy(null); }}
                    >
                      {g.institution_id === null && <option value="">-</option>}
                      {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                )}
                <td data-label="Status">
                  <span className={`pill ${cls(g.status)}`}>{STATUS_LABEL[g.status]}</span>
                  {g.status === "aktif" && g.approved_via && <div className="muted small">via {g.approved_via === "email" ? "email" : "admin"}</div>}
                </td>
                <td data-label="Daftar" className="nowrap">{g.created_at.slice(0, 10)}</td>
                <td className="act nowrap">
                  {g.status !== "aktif" && <RunButton className="btn sm primary" run={() => approveUser(g.id)} onResult={setNotice}>Setujui</RunButton>}{" "}
                  {g.status !== "ditolak" && (
                    <RunButton className="btn sm danger" run={() => rejectUser(g.id)} onResult={setNotice} confirm={g.status === "aktif" ? `Nonaktifkan ${g.name}?` : `Tolak ${g.name}?`}>
                      {g.status === "aktif" ? "Nonaktifkan" : "Tolak"}
                    </RunButton>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="muted">Tidak ada guru.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
