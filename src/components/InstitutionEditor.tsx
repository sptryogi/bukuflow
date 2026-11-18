"use client";

import { useState } from "react";
import { deleteInstitution, saveInstitution } from "@/app/actions/admin";
import { ActionForm, Modal, Notice, RunButton } from "@/components/ui";
import type { Result } from "@/lib/result";

export function NewInstitutionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ Tambah institusi</button>
      {open && (
        <Modal title="Tambah institusi" onClose={() => setOpen(false)}>
          <ActionForm action={saveInstitution} onDone={() => setOpen(false)}>
            <label className="f" htmlFor="iname">Nama sekolah / instansi</label>
            <input id="iname" name="name" className="input" required minLength={2} maxLength={150} autoFocus />
          </ActionForm>
        </Modal>
      )}
    </>
  );
}

export function InstitutionEditor({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  return (
    <>
      <div className="row">
        <button className="btn sm" onClick={() => setOpen(true)}>Ubah nama</button>
        <RunButton
          className="btn sm danger"
          run={() => deleteInstitution(id)}
          onResult={(r) => { setRes(r); if (r.ok) window.location.href = "/admin/institusi"; }}
          confirm={`Hapus ${name} beserta seluruh program dan data muridnya?`}
        >
          Hapus
        </RunButton>
      </div>
      <Notice r={res && !res.ok ? res : null} />
      {open && (
        <Modal title="Ubah institusi" onClose={() => setOpen(false)}>
          <ActionForm action={saveInstitution} onDone={() => setOpen(false)}>
            <input type="hidden" name="id" value={id} />
            <label className="f" htmlFor="iname2">Nama sekolah / instansi</label>
            <input id="iname2" name="name" className="input" defaultValue={name} required minLength={2} maxLength={150} autoFocus />
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
