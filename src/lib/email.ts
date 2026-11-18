type Sent = { ok: true } | { ok: false; error: string };

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, ""), email: m[2] } : { name: "NusaLiterasi", email: from.trim() };
}

/** Kirim email lewat Brevo atau Resend (REST, tanpa dependensi). */
export async function sendEmail(to: string, subject: string, html: string): Promise<Sent> {
  const from = process.env.EMAIL_FROM ?? "";
  const brevo = process.env.BREVO_API_KEY;
  const resend = process.env.RESEND_API_KEY;
  const provider = (process.env.EMAIL_PROVIDER ?? (brevo ? "brevo" : "resend")).toLowerCase();

  if (!from || (provider === "brevo" ? !brevo : !resend)) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[EMAIL DEV] Ke: ${to}\nSubjek: ${subject}\n${html.replace(/<[^>]+>/g, " ")}\n`);
      return { ok: true };
    }
    return { ok: false, error: "Pengiriman email belum dikonfigurasi oleh admin." };
  }

  try {
    let res: Response;
    if (provider === "brevo") {
      const s = parseFrom(from);
      res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevo!, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: s, to: [{ email: to }], subject, htmlContent: html }),
      });
    } else {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
    }
    if (!res.ok) {
      console.error("Email gagal:", res.status, await res.text());
      return { ok: false, error: "Email gagal dikirim. Coba lagi nanti atau pilih persetujuan admin." };
    }
    return { ok: true };
  } catch (e) {
    console.error("Email error:", e);
    return { ok: false, error: "Tidak dapat menghubungi layanan email." };
  }
}

export function verifyEmailHtml(name: string, link: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#17212b">
<h2 style="color:#0f766e">NusaLiterasi</h2>
<p>Halo ${esc(name)},</p>
<p>Terima kasih sudah mendaftar. Klik tombol di bawah untuk mengonfirmasi email Anda. Akun akan langsung aktif.</p>
<p><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Konfirmasi email</a></p>
<p style="font-size:13px;color:#667085">Link berlaku 24 jam. Jika tombol tidak berfungsi, salin alamat ini ke browser:<br>${link}</p>
<p style="font-size:13px;color:#667085">Jika Anda tidak merasa mendaftar, abaikan email ini.</p></div>`;
}
