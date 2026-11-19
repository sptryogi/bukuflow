"use client";

import { useActionState } from "react";
import { sendContact } from "@/app/actions/contact";

export default function ContactForm() {
  const [s, action, pending] = useActionState(sendContact, null);
  return (
    <form className="contact-form" action={action}>
      <h3>Kirim Pesan</h3>
      <p className="muted small">Pesan diteruskan ke tim kami melalui email.</p>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
      <label className="f" htmlFor="cf-nama">Nama Lengkap</label>
      <input id="cf-nama" name="nama" className="input" autoComplete="name" placeholder="Nama Anda" required maxLength={100} />
      <label className="f" htmlFor="cf-email">Email</label>
      <input id="cf-email" name="email" type="email" className="input" autoComplete="email" placeholder="nama@sekolah.sch.id" required maxLength={160} />
      <label className="f" htmlFor="cf-sekolah">Nama Sekolah</label>
      <input id="cf-sekolah" name="sekolah" className="input" placeholder="SD/SMP/SMA …" required maxLength={150} />
      <label className="f" htmlFor="cf-pesan">Pesan</label>
      <textarea id="cf-pesan" name="pesan" className="input" rows={4} placeholder="Ceritakan kebutuhan sekolah Anda…" required maxLength={2000} />
      {s?.error && <div className="notice err" role="alert">{s.error}</div>}
      {s?.ok && <div className="notice ok" role="status">{s.message}</div>}
      <button className="btn primary" style={{ width: "100%", marginTop: 12 }} disabled={pending}>{pending ? "Mengirim…" : "Kirim Pesan"}</button>
      <p className="muted small" style={{ margin: "10px 0 0" }}>Catatan: WhatsApp/telepon menyusul.</p>
    </form>
  );
}
