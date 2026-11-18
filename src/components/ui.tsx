"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import type { Level } from "@/lib/engine";
import type { Result } from "@/lib/result";

export function Badge({ level }: { level: Level }) {
  return <span className={`badge ${level}`}>{level}</span>;
}

export function Notice({ r }: { r: Result | null }) {
  if (!r) return null;
  const list = r.ok ? r.warnings : r.details;
  return (
    <div className={`notice ${r.ok ? (list?.length ? "warn" : "ok") : "err"}`} role={r.ok ? "status" : "alert"}>
      {r.ok ? r.message : r.error}
      {list && list.length > 0 && (
        <ul>
          {list.slice(0, 12).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
          {list.length > 12 && <li>…dan {list.length - 12} lainnya</li>}
        </ul>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn sm" onClick={onClose} aria-label="Tutup">
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ActionForm({
  action,
  onDone,
  confirm,
  submitLabel = "Simpan",
  resetOnOk = false,
  extra,
  children,
}: {
  action: (fd: FormData) => Promise<Result>;
  onDone?: (r: Result) => void;
  confirm?: string;
  submitLabel?: string;
  resetOnOk?: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await action(fd);
          setRes(r);
          if (r.ok) {
            if (resetOnOk) form.reset();
            onDone?.(r);
          }
        });
      }}
    >
      {children}
      <Notice r={res} />
      <div className="form-actions">
        <button className="btn primary" disabled={pending}>
          {pending ? "Memproses…" : submitLabel}
        </button>
        {extra}
      </div>
    </form>
  );
}

/** Tombol yang menjalankan server action langsung (hapus, generate, dst.). */
export function RunButton({
  run,
  confirm,
  onResult,
  className = "btn",
  children,
}: {
  run: () => Promise<Result>;
  confirm?: string;
  onResult?: (r: Result) => void;
  className?: string;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => onResult?.(await run()));
      }}
    >
      {pending ? "Memproses…" : children}
    </button>
  );
}
