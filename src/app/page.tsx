import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser, homeOf } from "@/lib/session";
import LandingNav from "@/components/LandingNav";
import Brand from "@/components/Logo";
import ContactForm from "@/components/ContactForm";
import "./landing.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "BukuFlow · Alokasi Buku Literasi untuk Sekolah dan Instansi" },
  description: "BukuFlow membagi judul buku ke setiap murid, minggu demi minggu, tanpa judul yang berulang. Unggah daftar murid, alokasi jadi otomatis.",
};

const FEATURES = [
  ["🧮", "Alokasi Otomatis", "Satu murid tidak pernah menerima judul yang sama dua kali dalam satu program. Judul dibagi rata, walaupun murid lebih banyak dari judul."],
  ["🗓️", "Rilis Mingguan", "Daftar buku minggu berikutnya terbuka otomatis setiap pekan pukul 02.00 WIB. Guru hanya melihat minggu yang sudah dirilis."],
  ["📤", "Unggah Excel", "Isi template murid (NIS, Nama, Level), unggah, lalu cek pratinjau dan validasi per baris sebelum disimpan."],
  ["📥", "Unduh Excel & PDF", "Unduh hasil alokasi per minggu untuk dibagikan ke kelas, lengkap dengan riwayat minggu sebelumnya."],
] as const;

const STEPS = [
  ["1", "Daftar & pilih institusi", "Guru mendaftar, lalu mengaktifkan akun lewat email atau persetujuan admin."],
  ["2", "Unggah daftar murid", "Unduh template Excel, isi NIS, nama, dan level (Pemula, Madya, Mahir), lalu unggah."],
  ["3", "Alokasi berjalan", "BukuFlow membuat jadwal buku 3, 6, atau 12 bulan. Setiap minggu terbuka otomatis."],
] as const;

const FAQ = [
  ["Apakah satu murid bisa mendapat buku yang sama dua kali?", "Tidak dalam satu program. Program lanjutan juga menghindari judul yang sudah pernah dibaca murid."],
  ["Bagaimana jika murid lebih banyak dari judul buku?", "Judul dibagi rata ke murid. Pada minggu yang sama beberapa murid boleh membaca judul yang sama, tetapi tiap murid tetap mendapat judul berbeda dari minggu ke minggu."],
  ["Kapan daftar buku minggu berikutnya terlihat?", "Otomatis setiap pekan pukul 02.00 WIB, pada hari yang sama dengan hari mulai program."],
  ["Berapa jumlah murid maksimal?", "Batas diatur oleh admin dan bisa disesuaikan dengan kebutuhan institusi."],
] as const;

export default async function Landing() {
  let home: string | null = null;
  try {
    const u = await getSessionUser();
    if (u) home = homeOf(u.role);
  } catch {
    home = null;
  }
  return (
    <div className="lp">
      <a className="skip-link" href="#konten-utama">Lewati ke konten utama</a>
      <LandingNav home={home} />
      <main id="konten-utama">
        <section className="hero" id="beranda" aria-labelledby="hero-title">
          <div className="lp-container hero-grid">
            <div>
              <p className="eyebrow"><span aria-hidden="true">📚</span> Alokasi buku literasi untuk sekolah</p>
              <h1 id="hero-title">Atur Buku Bacaan Murid, <span className="highlight">Mengalir</span> Setiap Minggu</h1>
              <p className="hero-lead">
                BukuFlow membagi judul buku ke setiap murid secara otomatis, adil, dan tanpa judul yang berulang. Unggah daftar murid, lalu pantau alokasi minggu demi minggu.
              </p>
              <div className="hero-actions">
                {home ? (
                  <Link href={home} className="btn primary btn-lg">Buka Dashboard <span aria-hidden="true">→</span></Link>
                ) : (
                  <>
                    <Link href="/daftar" className="btn primary btn-lg">Daftar Guru <span aria-hidden="true">→</span></Link>
                    <Link href="/login" className="btn btn-lg">Masuk</Link>
                  </>
                )}
              </div>
              <ul className="hero-badges" aria-label="Keunggulan singkat">
                <li><span aria-hidden="true">✅</span> Tanpa judul berulang</li>
                <li><span aria-hidden="true">🎓</span> Level Pemula · Madya · Mahir</li>
                <li><span aria-hidden="true">📱</span> Nyaman di HP</li>
              </ul>
            </div>
            <div className="hero-art">
              <svg className="hero-illustration" viewBox="0 0 520 440" role="img" aria-label="Ilustrasi buku terbuka dengan jadwal minggu yang mengalir">
                <circle cx="270" cy="220" r="190" fill="#e8eeff" />
                <circle cx="400" cy="90" r="46" fill="#ffe9b8" />
                <circle cx="90" cy="340" r="34" fill="#c9f3e4" />
                <g fontFamily="Baloo 2, sans-serif" fontWeight="800">
                  <rect x="40" y="70" width="104" height="44" rx="12" fill="#ff9f1c" transform="rotate(-8 92 92)" />
                  <text x="92" y="100" textAnchor="middle" fontSize="20" fill="#fff" transform="rotate(-8 92 92)">Minggu 1</text>
                  <rect x="380" y="190" width="104" height="44" rx="12" fill="#2ec4b6" transform="rotate(8 432 212)" />
                  <text x="432" y="218" textAnchor="middle" fontSize="20" fill="#fff" transform="rotate(8 432 212)">Minggu 2</text>
                  <rect x="90" y="378" width="104" height="44" rx="12" fill="#4361ee" transform="rotate(5 142 400)" />
                  <text x="142" y="407" textAnchor="middle" fontSize="20" fill="#fff" transform="rotate(5 142 400)">Minggu 3</text>
                </g>
                <path d="M120 250c45-28 95-28 140 8v120c-45-36-95-36-140-8V250z" fill="#4361ee" />
                <path d="M400 250c-45-28-95-28-140 8v120c45-36 95-36 140-8V250z" fill="#fff" stroke="#4361ee" strokeWidth="6" />
                <path d="M260 258v120" stroke="#1d2a78" strokeWidth="6" strokeLinecap="round" />
                <g stroke="#c9d4ff" strokeWidth="7" strokeLinecap="round"><path d="M290 290h80" /><path d="M290 315h95" /><path d="M290 340h70" /></g>
                <path d="M70 410c40-30 80 30 120 0s80-30 120 0 80 30 120 0" stroke="#2ec4b6" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.7" />
                <path d="M430 130l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#ffb703" />
              </svg>
            </div>
          </div>
        </section>

        <section className="section" id="tentang" aria-labelledby="tentang-title">
          <div className="lp-container">
            <header className="section-head">
              <p className="section-kicker">Tentang BukuFlow</p>
              <h2 id="tentang-title">Alokasi Buku yang Rapi, Tanpa Tabel Manual</h2>
              <p className="section-sub">Tidak perlu lagi menghitung rotasi buku di spreadsheet. BukuFlow menyusun jadwal bacaan seluruh murid dalam hitungan detik.</p>
            </header>
            <div className="about-grid">
              <article className="about-card">
                <div className="about-icon" aria-hidden="true">📖</div>
                <h3>Untuk Guru</h3>
                <p>Lihat buku tiap murid minggu ini, telusuri riwayat minggu lalu, dan unduh hasilnya sebagai Excel atau PDF.</p>
              </article>
              <article className="about-card">
                <div className="about-icon" aria-hidden="true">🏫</div>
                <h3>Untuk Admin</h3>
                <p>Kelola institusi, guru, katalog buku, dan program 3, 6, atau 12 bulan. Atur kapan program dimulai dan batas jumlah murid.</p>
              </article>
              <article className="about-card about-card-accent">
                <div className="about-icon" aria-hidden="true">💡</div>
                <h3>Mulai Sekarang</h3>
                <p>Daftar sebagai guru, pilih institusi, lalu unggah daftar murid. Alokasi pertama siap dalam beberapa menit.</p>
                <Link href={home ?? "/daftar"} className="btn btn-light">{home ? "Buka Dashboard" : "Daftar Guru"}</Link>
              </article>
            </div>
          </div>
        </section>

        <section className="section section-alt" id="fitur" aria-labelledby="fitur-title">
          <div className="lp-container">
            <header className="section-head">
              <p className="section-kicker">Fitur</p>
              <h2 id="fitur-title">Empat Hal yang Membuat Alokasi Jadi Mudah</h2>
            </header>
            <div className="card-grid card-grid-4">
              {FEATURES.map(([emoji, title, text]) => (
                <article className="feature-card" key={title}>
                  <span className="feature-emoji" aria-hidden="true">{emoji}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>

            <header className="section-head section-head-sub">
              <h3>Tiga Level Bacaan</h3>
              <p className="section-sub">Murid mendapat buku sesuai levelnya lebih dulu. Bila judul di levelnya habis, BukuFlow memakai level terdekat.</p>
            </header>
            <div className="card-grid card-grid-3">
              <article className="level-card level-1"><p className="level-tag">Level 1</p><h4>Pemula</h4><p>Bacaan ringan untuk membangun kebiasaan membaca.</p></article>
              <article className="level-card level-2"><p className="level-tag">Level 2</p><h4>Madya</h4><p>Bacaan menengah untuk murid yang sudah lancar.</p></article>
              <article className="level-card level-3"><p className="level-tag">Level 3</p><h4>Mahir</h4><p>Bacaan lebih menantang untuk pembaca percaya diri.</p></article>
            </div>
          </div>
        </section>

        <section className="stats" aria-label="Ringkasan">
          <div className="lp-container">
            <ul className="stats-grid">
              <li className="stat-item"><p className="stat-number">101</p><p className="stat-label">📚 Judul di katalog awal</p></li>
              <li className="stat-item"><p className="stat-number">3</p><p className="stat-label">🎓 Level bacaan</p></li>
              <li className="stat-item"><p className="stat-number">12–48</p><p className="stat-label">🗓️ Minggu per program</p></li>
            </ul>
          </div>
        </section>

        <section className="section" id="cara-kerja" aria-labelledby="cara-title">
          <div className="lp-container">
            <header className="section-head">
              <p className="section-kicker">Cara Kerja</p>
              <h2 id="cara-title">Tiga Langkah dari Daftar sampai Alokasi</h2>
            </header>
            <ol className="steps">
              {STEPS.map(([n, title, text]) => (
                <li className="step" key={n}>
                  <span className="step-num" aria-hidden="true">{n}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section-alt" id="faq" aria-labelledby="faq-title">
          <div className="lp-container faq-wrap">
            <header className="section-head">
              <p className="section-kicker">FAQ</p>
              <h2 id="faq-title">Pertanyaan yang Sering Diajukan</h2>
            </header>
            {FAQ.map(([q, a]) => (
              <details className="faq" key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section cta-section" id="kontak" aria-labelledby="kontak-title">
          <div className="lp-container cta-panel">
            <div className="cta-copy">
              <p className="section-kicker section-kicker-light">Kontak &amp; Pendaftaran</p>
              <h2 id="kontak-title">Siap Membangun Sekolah Pembaca?</h2>
              <p>Hubungi tim BukuFlow atau daftarkan sekolah Anda sekarang. Kami siap membantu menyiapkan kelas membaca pertama dalam satu minggu.</p>
              <ul className="contact-list">
                <li><span aria-hidden="true">📧</span> <a href="mailto:dianrakyatdigital@gmail.com">dianrakyatdigital@gmail.com</a></li>
                <li><span aria-hidden="true">📞</span> <a href="tel:+622112345678">(021) 1234-5678</a></li>
                <li><span aria-hidden="true">📍</span> <span>Jl. Buncit Persada No. 1, Kalibata, Pancoran, Jakarta Selatan</span></li>
              </ul>
              <div className="cta-actions">
                {home ? (
                  <Link href={home} className="btn btn-light btn-lg">Buka Dashboard</Link>
                ) : (
                  <>
                    <Link href="/daftar" className="btn btn-light btn-lg">Daftar Sekarang</Link>
                    <Link href="/login" className="btn btn-outline-light btn-lg">Sudah Punya Akun? Masuk</Link>
                  </>
                )}
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="lp-container footer-grid">
          <div>
            <div className="footer-brand"><Brand /></div>
            <p>Alokasi buku literasi mingguan untuk sekolah dan instansi.</p>
          </div>
          <nav aria-label="Navigasi footer">
            <h3>Navigasi</h3>
            <ul>
              <li><a href="#tentang">Tentang</a></li>
              <li><a href="#fitur">Fitur</a></li>
              <li><a href="#cara-kerja">Cara Kerja</a></li>
              <li><a href="#faq">FAQ</a></li>
              <li><a href="#kontak">Kontak</a></li>
            </ul>
          </nav>
          <div>
            <h3>Akun</h3>
            <ul>
              <li><Link href="/login">Masuk</Link></li>
              <li><Link href="/daftar">Daftar Guru</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom"><div className="lp-container"><p>&copy; {new Date().getFullYear()} BukuFlow. Hak cipta dilindungi undang-undang.</p></div></div>
      </footer>
    </div>
  );
}
