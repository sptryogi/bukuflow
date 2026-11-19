"use client";

import { useState } from "react";
import { createProgram, deleteProgram, updateProgram } from "@/app/actions/admin";
import { ActionForm, Modal, RunButton } from "@/components/ui";
import { dayName, nextMonday, nextMonthStr, todayWib } from "@/lib/schedule";
import type { Result } from "@/lib/result";

type Opt = { id: number; label: string };

function Form(props: {
  institutionId: number;
  program?: { id: number; months: number; copies: number; status: string };
  prev: Opt[];
  onClose: () => void;
}) {
  const edit = !!props.program;
  const [mode, setMode] = useState<"awal_bulan" | "senin_depan" | "hari_ini" | "lanjutan">(edit ? "lanjutan" : "awal_bulan");
  const today = todayWib(Date.now());
  const monday = nextMonday(Date.now());
  const running = edit && props.program!.status === "siap";
  const canContinueFromPrev = !edit && props.prev.length > 0;
  return (
    <Modal title={edit ? "Atur program" : "Buat program"} onClose={props.onClose}>
      <ActionForm action={edit ? updateProgram : createProgram} onDone={props.onClose} submitLabel="Simpan">
        {edit ? <input type="hidden" name="id" value={props.program!.id} /> : <input type="hidden" name="institution_id" value={props.institutionId} />}
        <input type="hidden" name="mode" value={mode} />
        <div className="fields" style={{ marginBottom: 8 }}>
          <div>
            <label className="f" htmlFor="months">Durasi program</label>
            <select id="months" name="months" className="input" defaultValue={edit ? props.program!.months : 3}>
              <option value={3}>3 bulan (12 minggu)</option>
              <option value={6}>6 bulan (24 minggu)</option>
              <option value={12}>12 bulan (48 minggu)</option>
            </select>
          </div>
          {!edit && (
            <div>
              <label className="f" htmlFor="copies">Eksemplar per judul (minimum)</label>
              <input id="copies" name="copies" type="number" min={1} max={20} defaultValue={2} className="input" />
              <div className="muted small" style={{ marginTop: 4 }}>Bila murid lebih banyak dari judul, batas ini naik otomatis dan judul dibagi rata.</div>
            </div>
          )}
        </div>

        <label className="radio">
          <input type="radio" checked={mode === "awal_bulan"} onChange={() => setMode("awal_bulan")} />
          <span>
            <strong>Mulai dari awal bulan</strong>
            <div className="muted small">
              {edit ? "Alokasi dibuat ulang dari minggu pertama pada bulan yang dipilih." : "Program dimulai Senin pertama pada bulan yang dipilih."}
            </div>
            {mode === "awal_bulan" && (
              <input name="month" type="month" className="input" style={{ marginTop: 8 }} defaultValue={nextMonthStr(Date.now())} required />
            )}
          </span>
        </label>

        <label className="radio">
          <input type="radio" checked={mode === "senin_depan"} onChange={() => setMode("senin_depan")} />
          <span>
            <strong>Mulai Senin depan</strong>
            <div className="muted small">{dayName(monday)}, {monday}. Minggu berikutnya dirilis tiap Senin 02.00 WIB.</div>
          </span>
        </label>

        <label className="radio">
          <input type="radio" checked={mode === "hari_ini"} onChange={() => setMode("hari_ini")} />
          <span>
            <strong>Mulai hari ini (untuk uji coba)</strong>
            <div className="muted small">{dayName(today)}, {today}. Minggu 1 langsung terbuka; minggu berikutnya dirilis tiap {dayName(today)} 02.00 WIB.</div>
          </span>
        </label>

        {(edit || canContinueFromPrev) && (
          <label className="radio">
            <input type="radio" checked={mode === "lanjutan"} onChange={() => setMode("lanjutan")} />
            <span>
              <strong>{edit ? "Lanjutkan yang sudah berjalan" : "Lanjutkan program sebelumnya"}</strong>
              <div className="muted small">
                {edit
                  ? running
                    ? "Minggu yang sudah dirilis tidak berubah. Hanya sisa minggu yang disesuaikan dengan durasi baru."
                    : "Tanggal mulai tetap, hanya durasi yang berubah."
                  : "Mulai tepat setelah program terpilih selesai. Judul yang sudah dibaca murid tidak akan diberikan lagi."}
              </div>
              {!edit && mode === "lanjutan" && (
                <select name="continue_id" className="input" style={{ marginTop: 8 }} required>
                  {props.prev.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
            </span>
          </label>
        )}
      </ActionForm>
    </Modal>
  );
}

export function CreateProgramButton(props: { institutionId: number; prev: Opt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ Buat program</button>
      {open && <Form institutionId={props.institutionId} prev={props.prev} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProgramAdminActions(props: { institutionId: number; program: { id: number; months: number; copies: number; status: string }; backHref: string }) {
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Atur program</button>
      <RunButton
        className="btn danger"
        run={() => deleteProgram(props.program.id)}
        onResult={(r) => { setRes(r); if (r.ok) window.location.href = props.backHref; }}
        confirm="Hapus program ini beserta seluruh alokasinya? Tindakan ini tidak dapat dibatalkan."
      >
        Hapus
      </RunButton>
      {res && !res.ok && <span className="pill bad">{res.error}</span>}
      {open && <Form institutionId={props.institutionId} program={props.program} prev={[]} onClose={() => setOpen(false)} />}
    </>
  );
}
