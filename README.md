# BukuFlow · Aplikasi Alokasi Buku (Admin + Guru)

> Dulu bernama NusaLiterasi. Halaman depan (landing) di `/`, tombol Masuk/Daftar membuka aplikasi.

Web app (desktop dan HP) untuk mengalokasikan judul buku ke murid per minggu, per institusi dan per program (3, 6, atau 12 bulan).
**Stack:** Next.js 15 · Neon Postgres (serverless) · Vercel · email lewat Brevo/Resend.

## Peran dan alur

**Guru** mendaftar (Nama, Sekolah/Instansi, Email, Password, Konfirmasi Password), lalu memilih:
1. **Konfirmasi lewat email**: klik link di email, akun langsung **aktif** (di admin tercatat "via email"), atau
2. **Tunggu persetujuan admin**: masuk daftar admin, admin menekan **Setujui** (tercatat "via admin"), lalu tombol *Kembali* ke login.

Login memakai **email + password**. Akun admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default `admin` / `DRPersada01`, **ganti setelah login pertama**).

**Admin** punya: Ringkasan + profil, daftar **Institusi** (terdaftar / menunggu), daftar **Guru** (semua institusi, tombol Setujui/Tolak), dan **Katalog Buku**.
Di halaman institusi: guru terdaftar, program, ubah nama, unduh template murid, **Buat program** (3/6/12 bulan; *mulai dari awal bulan* atau *lanjutkan program sebelumnya*), dan **Atur program** (ubah durasi; *mulai dari awal bulan* atau *lanjutkan yang sudah berjalan*).
Program baru berstatus **Menunggu data murid** sampai template Excel (Instansi, NIS, Nama Murid, Level) diunggah oleh guru atau admin. Ada pratinjau dan validasi per baris sebelum disimpan.

**Guru** melihat: profil, instansi, program (progress bar), tabel alokasi sebelum diunduh, **unduh Excel/PDF**, dan **riwayat** minggu ke minggu.

## Aturan alokasi

- Murid **tidak pernah menerima judul yang sama** dua kali dalam satu program (termasuk program lanjutan).
- Satu judul idealnya dibaca maksimal *eksemplar per judul* murid (default 2) pada minggu yang sama. **Bila murid lebih banyak dari judul × eksemplar, batas ini naik otomatis** dan judul dibagi rata (mis. 300 murid / 101 judul = sekitar 3 murid per judul per minggu). Alokasi tidak lagi ditolak karena itu. Yang tetap dilarang: satu murid menerima judul yang sama dua kali dalam satu program.
- Level sendiri dulu, memakai rotasi yang sama dengan Excel (kelompok g, minggu w, judul ke-(g+w−1) mod jumlah judul). Jika judul level murid habis, ambil **satu level di atasnya**; level teratas (Mahir) jatuh ke level di bawahnya:
  Pemula → Madya → Mahir · Madya → Mahir → Pemula · Mahir → Madya → Pemula.
- Setiap minggu dicocokkan dengan bipartite matching agar kapasitas terpakai optimal. Jika katalog benar-benar tidak cukup, alokasi **ditolak dengan pesan jelas** dan tidak ada data yang berubah.
- 1 bulan = 4 minggu (3/6/12 bulan = 12/24/48 minggu). Sudah diuji: 300 murid × 48 minggu (bahkan 101 minggu) dengan katalog 101 judul.
- **Mulai program**: *awal bulan* (Senin pertama bulan pilihan), *Senin depan*, atau *hari ini* (untuk uji coba). Minggu berikutnya rilis tiap pekan pukul 02.00 WIB pada hari yang sama dengan hari mulai.
- **Maksimal murid per program** diatur admin di Ringkasan → Pengaturan (default 300). Berlaku untuk unggahan dan jumlah baris template Excel.
- Seluruh alokasi dibuat sekali saat program diaktifkan. **Minggu baru terlihat otomatis tiap pekan pukul 02.00 WIB**; tidak perlu cron. Guru hanya menerima data minggu yang sudah dirilis.
- Program berjalan yang diubah durasinya atau daftar muridnya (*lanjutkan yang sudah berjalan*) **tidak mengubah minggu yang sudah dirilis**.

## Deploy dari nol

Yang perlu disiapkan: akun **GitHub**, **Neon** (database), **Vercel** (hosting), dan **Brevo** (email, gratis). Sekitar 30 menit.

### 1. Push ke GitHub

1. Ekstrak zip, buka terminal di folder `bukuflow`.
2. Buat repository kosong di <https://github.com/new> (nama bebas, misal `bukuflow`, pilih **Private**, jangan centang README).
3. Jalankan:
   ```bash
   git init
   git add .
   git commit -m "BukuFlow v2"
   git branch -M main
   git remote add origin https://github.com/USERNAME/bukuflow.git
   git push -u origin main
   ```
   File `.env*` sudah masuk `.gitignore`, jadi rahasia tidak ikut terunggah.

### 2. Database di Neon

1. Daftar di <https://neon.com>, klik **Create project**.
2. **Region: AWS Asia Pacific (Singapore)**. Dekat dengan Indonesia dan dengan region fungsi Vercel (`sin1`, sudah diatur di `vercel.json`).
3. Di dashboard project klik **Connect**, pilih **Pooled connection**, salin *connection string* (diawali `postgresql://…`). Ini nilai `DATABASE_URL`.
4. Isi tabel dan katalog 101 buku, pilih **salah satu** (untuk database lama: jalankan ulang `db/schema.sql`, aman, hanya menambah tabel `settings`):
   - **Tanpa terminal:** menu **SQL Editor** di Neon. Tempel seluruh isi `db/schema.sql`, tekan **Run**. Lalu tempel isi `db/seed.sql`, **Run**.
   - **Dengan terminal:** `cp .env.example .env.local`, isi `DATABASE_URL`, lalu `npm install && npm run db:setup`.

> Free plan Neon cukup untuk aplikasi ini. Compute otomatis tidur bila lama tidak dipakai, jadi akses pertama setelah lama diam bisa sedikit lebih lambat.
> Alternatif: di Vercel buka **Storage → Marketplace → Neon**, `DATABASE_URL` terisi otomatis. Tetap jalankan langkah 4.

### 3. Email konfirmasi (Brevo, disarankan)

Link konfirmasi dikirim lewat API email. Pilih **Brevo** (paling mudah, gratis 300 email/hari, cukup verifikasi alamat pengirim):

1. Daftar di <https://www.brevo.com>.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: isi nama (BukuFlow) dan alamat email pengirim, lalu klik link verifikasi yang masuk ke email tersebut.
   Untuk pengiriman ke inbox yang lebih terpercaya (tidak masuk spam), sebaiknya pakai alamat di **domain milik Anda** dan verifikasi domainnya (SPF/DKIM) di menu yang sama.
3. **SMTP & API → API Keys → Generate a new API key**, salin nilainya (`xkeysib-…`).
4. Isi env: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY=…`, `EMAIL_FROM=BukuFlow <alamat-yang-sudah-diverifikasi>`.

**Resend** juga didukung (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`), tetapi Resend **mewajibkan domain yang sudah diverifikasi** agar bisa mengirim ke selain email Anda sendiri. Tanpa domain, pakai Brevo.

> Tanpa konfigurasi email, pilihan "konfirmasi lewat email" menampilkan pesan gagal, sedangkan pilihan "tunggu persetujuan admin" tetap berfungsi penuh.

### 4. Deploy di Vercel

1. Masuk <https://vercel.com> dengan akun GitHub, **Add New → Project**, pilih repo `bukuflow`, **Import**. Framework terdeteksi otomatis (Next.js).
2. Buka **Environment Variables**, tambahkan:

   | Nama | Nilai |
   |---|---|
   | `DATABASE_URL` | connection string pooled dari Neon |
   | `ADMIN_EMAIL` | `admin` |
   | `ADMIN_PASSWORD` | `DRPersada01` (ganti setelah login pertama) |
   | `SESSION_SECRET` | string acak ≥ 32 karakter: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `APP_URL` | alamat aplikasi, misal `https://bukuflow.vercel.app` (isi setelah tahu URL-nya, lihat langkah 4) |
   | `EMAIL_PROVIDER`, `BREVO_API_KEY`, `EMAIL_FROM` | dari langkah 3 |

3. Klik **Deploy**.
4. Setelah selesai, salin URL produksi dari Vercel, isi/ubah `APP_URL` dengan URL itu di **Settings → Environment Variables**, lalu **Deployments → ⋯ → Redeploy** agar link di email benar.
5. (Opsional) Domain sendiri: **Settings → Domains**. Setelah itu perbarui `APP_URL`.

> **Lisensi Vercel:** paket Hobby (gratis) hanya untuk penggunaan personal non-komersial. Bila aplikasi dipakai untuk program/bisnis berbayar, gunakan paket Pro.

### 5. Cek setelah deploy

1. Buka URL aplikasi, login `admin` / `DRPersada01` (admin dibuat otomatis saat login pertama). **Segera ganti password** di Ringkasan → Profil → Ganti password.
2. Buka jendela penyamaran, daftar sebagai guru contoh, coba kedua pilihan konfirmasi.
3. Di admin: buka Institusi, buat program, unduh template, isi 5 murid, unggah, lihat hasilnya, lalu cek akun guru.
4. Hapus data contoh bila sudah selesai.

## Pemecahan masalah

| Gejala | Penyebab / solusi |
|---|---|
| Halaman error "Database belum siap" | `DATABASE_URL` salah/kosong, atau `schema.sql` belum dijalankan |
| Login admin gagal | `ADMIN_EMAIL`/`ADMIN_PASSWORD` belum diisi di Vercel saat login pertama. Isi lalu redeploy. Setelah admin terbentuk, password mengikuti yang tersimpan di database |
| Email tidak terkirim | Pengirim belum diverifikasi (Brevo), atau memakai Resend tanpa domain. Cek `EMAIL_FROM` sama persis dengan pengirim terverifikasi dan lihat Vercel → Logs |
| Link email membuka alamat salah | `APP_URL` belum diisi/di-redeploy |
| "Alokasi tidak dapat dibuat" | Hanya terjadi bila durasi (minggu) melebihi jumlah judul katalog sehingga murid kehabisan judul baru. Kurangi durasi atau tambah judul di Katalog Buku |
| Upload ditolak | Pakai template resmi, NIS unik dan tidak kosong, level dari dropdown. Pesan error menyebut nomor baris |

## Catatan keamanan

- Semua halaman, unduhan, dan server action memeriksa login **dan peran**; guru hanya dapat membuka program institusinya sendiri.
- Password disimpan dengan hash `scrypt`; sesi memakai cookie bertanda tangan (`httpOnly`, 7 hari). Percobaan login dan pendaftaran dibatasi lajunya.
- Konfirmasi email membuat akun **langsung aktif**, sesuai rancangan. Artinya siapa pun yang memiliki alamat email dapat mengaktifkan akun sendiri. Jika ingin lebih ketat, hapus pilihan email dan gunakan persetujuan admin saja.
- Kata sandi admin awal tercantum di dokumen kebutuhan. Anggap sementara dan ganti.
- Proyek dikunci ke **Next.js 15** karena memakai `middleware.ts` (di Next 16 berganti nama menjadi `proxy.ts`).

## Pengembangan

```bash
npm install
cp .env.example .env.local     # isi variabel
npm run db:setup               # buat tabel + katalog
npm run dev                    # http://localhost:3000  (email dicetak di terminal bila belum dikonfigurasi)
npm test                       # uji mesin alokasi dan jadwal (Node >= 22.6)
npm run build
```

```
db/            schema.sql, seed.sql (101 judul dari Excel)
scripts/       setup-db.mjs, test-engine.ts
src/lib/       engine.ts (alokasi), schedule.ts (jadwal WIB), build.ts (simpan atomik), q.ts, auth, email, excel, pdf
src/app/       admin/, guru/, login, daftar, verifikasi, download/, actions/
```


## Asesmen membaca (cetak lembar, unggah foto, nilai otomatis)

Alur tiap minggu, per murid, sesuai buku yang dialokasikan minggu itu:

1. **Kamis** (bisa diatur): guru buka program → tab **Asesmen** → *Unduh semua (ZIP)*. Satu murid satu PDF; yang terisi otomatis hanya NIS, Nama, Tanggal (kolom Kelas dan penghitung halaman dihapus). Unduhan tercatat dan terlihat admin.
2. **Jumat sampai Senin 08.00 WIB** (bisa diatur): guru foto/scan lembar yang sudah dijawab, unggah (boleh banyak file sekaligus). Penilai AI membaca NIS di kertas, mencocokkan murid, dan memberi nilai 0-100 (10 soal x 10). Hasil yang meragukan ditandai *Perlu dicek*. Nilai bisa dikoreksi manual.
3. Tab Asesmen → **Riwayat nilai** (Excel/PDF): NIS, Nama, Level, lalu satu kolom per minggu yang sudah bernilai.

Pengaturan: Admin → Ringkasan → Pengaturan (hari buka cetak, batas unggah). Untuk uji coba isi hari buka cetak **0**.

### Setup sekali
- `npm run db:setup` (menambah tabel asesmen; aman diulang).
- `npm run db:asesmen` memuat 100 lembar asesmen dari `scripts/asesmen-stock/` ke database (dicocokkan berdasarkan JUDUL). `-- --dry` untuk cek tanpa menyentuh database.
- Environment Vercel: `DEEPSEEK_API_KEY` (wajib untuk penilaian otomatis), `DEEPSEEK_MODEL` (opsional, default `deepseek-flash`), `CONTACT_TO` (opsional).
- Stok tambahan/penggantian: Admin → Buku → Stok Asesmen (PDF 1 halaman per judul + rubrik opsional).
- Foto tidak disimpan (hemat database); hanya nilai dan ringkasan per soal.
