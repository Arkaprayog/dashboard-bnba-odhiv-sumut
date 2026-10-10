# Data Base PPKS ODHIV Sumut — Cloudflare secure starter

Starter ini menyediakan kerangka backend password + WebAuthn/passkey multi-perangkat, skema D1, sesi HttpOnly, pemeriksaan Origin/CSRF, peran akun, audit dasar, dan halaman login bertema hijau-biru.

## Status dan batas penting

**Ini paket integrasi awal yang tetap belum siap produksi atau diaudit.** Adapter Google Sheets/Drive sisi server sudah ditambahkan, tetapi harus dikonfigurasi dan diuji di staging terlebih dahulu. Dashboard frontend penuh, provisioning owner, rate limiting, dan pengelolaan admin belum lengkap; jangan masukkan data nyata sebelum seluruh checklist keamanan selesai. Implementasi perlu ditinjau developer berpengalaman, diuji di staging, dan diuji terhadap versi library WebAuthn yang digunakan.

Yang belum disertakan secara aktif:
- Dashboard data lengkap dan UI pengelolaan Desil/Status Laporan/Template belum dibuat; endpoint responden mengembalikan data sumber untuk integrasi frontend.
- Pembuatan owner pertama. Buat akun awal melalui skrip provisioning yang aman setelah review kode; jangan membuka endpoint publik untuk membuat owner.
- Rate limiting persisten dan perlindungan brute-force. Pasang Cloudflare rate limiting/WAF sebelum membuka akses.
- Alur pemulihan akun, pencabutan passkey oleh owner, serta UI pengelolaan petugas lengkap.
- Uji penetrasi, kebijakan retensi, backup/restore, dan peninjauan privasi.

## Prasyarat

- Akun Cloudflare; domain HTTPS milik organisasi sangat disarankan.
- Node.js LTS dan npm di komputer.
- Project Google Cloud dengan Google Sheets API dan Google Drive API diaktifkan.
- Akun layanan Google (service account) dengan akses minimum yang diperlukan ke spreadsheet dan folder Drive privat.

## 1. Siapkan project

```bash
npm install
npx wrangler login
npx wrangler d1 create ppks-odhiv-auth
```

Salin `database_id` dari hasil perintah ke `wrangler.toml`, menggantikan `GANTI_DENGAN_DATABASE_ID`.

Terapkan skema:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

Jangan menjalankan migrasi remote sebelum memeriksa akun dan database Cloudflare yang benar.

## 2. Konfigurasi domain WebAuthn

Di `wrangler.toml`, atur:
- `APP_ORIGIN` ke origin final, contoh `https://dashboard.domain-organisasi.id` (tanpa slash terakhir).
- `WEBAUTHN_RP_ID` ke hostname persis, contoh `dashboard.domain-organisasi.id` (tanpa protokol dan path).
- `WEBAUTHN_RP_NAME` sesuai nama portal.

WebAuthn mengikat kredensial ke origin/RP ID. Mengubah domain setelah passkey didaftarkan dapat membuat passkey lama tidak dapat dipakai.

## 3. Rahasia

Simpan rahasia dengan Wrangler secrets, jangan masukkan ke file yang dikomit atau frontend. Contoh untuk integrasi Google nanti:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put GOOGLE_SHEET_ID
npx wrangler secret put GOOGLE_SHEET_TAB
npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
```

`GOOGLE_SERVICE_ACCOUNT_JSON` harus berisi JSON service account satu baris. Batasi service account hanya ke spreadsheet yang dibutuhkan dan folder Drive foto yang relevan. Jangan membuat folder atau foto menjadi public. Untuk organisasi, gunakan kebijakan Google Workspace yang disetujui dan tinjau apakah service account sesuai kebijakan pengelolaan data.

## 4. Membuat akun owner awal

Tidak ada endpoint publik untuk membuat owner pertama dengan sengaja. Ini menghindari penyerang mengambil alih sistem sebelum admin dibuat.

Sebelum produksi, buat skrip provisioning satu kali yang:
1. dijalankan lokal oleh operator yang berwenang;
2. meminta username, nama tampilan, dan password panjang secara interaktif;
3. menghitung PBKDF2 dengan parameter yang sama seperti `src/index.ts`;
4. memasukkan owner ke D1 menggunakan binding/alat admin yang aman;
5. tidak mencetak password/hash/rahasia ke log;
6. dihapus atau dinonaktifkan setelah selesai.

PBKDF2 di starter ini menggunakan Web Crypto (310.000 iterasi, SHA-256). Minta peninjau keamanan menilai parameter, penanganan rahasia, rate limiting, dan strategi upgrade sebelum produksi.

## 5. Pendaftaran passkey dan multi-perangkat

Alur starter mewajibkan password terlebih dahulu, lalu WebAuthn. Setelah owner dibuat, implementasikan prosedur bootstrap pertama secara tertutup sebelum petugas memakai aplikasi. Endpoint pendaftaran passkey saat ini mensyaratkan sesi aktif dengan role owner/admin. Jangan membuat jalan pintas publik untuk melewati syarat ini.

Setiap petugas harus memiliki akun individual. Untuk menambah perangkat, petugas login lalu mendaftarkan passkey baru; passkey tersinkronisasi juga dapat tersedia tergantung pengelola passkey dan kebijakan perangkat. Biometrik tidak dikirim ke server; OS/authenticator menangani sidik jari/wajah/PIN.

## 6. Aktifkan koneksi Google Sheets dan foto Drive privat

Kode server menggunakan service account untuk mengambil data langsung dari Google Sheets API dan foto melalui Drive API. Kredensial tidak dikirim ke browser.

1. Di Google Cloud Console, pastikan **Google Sheets API** dan **Google Drive API** sama-sama Enabled pada project yang memiliki service account.
2. Di Google Sheets, bagikan spreadsheet kepada email service account sebagai **Viewer**. Akses umum tetap **Restricted**.
3. Untuk foto, buka folder Drive tempat foto unggahan Google Form disimpan dan bagikan folder tersebut kepada service account sebagai **Viewer**. Jangan mengubah folder/foto menjadi publik. Jika kebijakan organisasi melarang berbagi folder ini, hentikan dan minta administrator Google Workspace memilih metode akses yang disetujui.
4. Deploy Worker ke lingkungan staging dahulu. Di Cloudflare Dashboard → Workers & Pages → pilih Worker → Settings → Variables and Secrets, tambahkan **Secret** bernama `GOOGLE_SERVICE_ACCOUNT_JSON`, lalu masukkan seluruh isi file JSON. Jangan menaruh isi JSON di `wrangler.toml`, source code, chat, atau variabel frontend.
5. Tambahkan konfigurasi `GOOGLE_SHEET_ID` dengan nilai ID spreadsheet dan `GOOGLE_SHEET_TAB` dengan `From Response 1`. ID spreadsheet yang dimaksud sudah dicantumkan di bawah. Gunakan Secret/variable sisi server sesuai kebijakan organisasi.
6. Tambahkan `GOOGLE_DRIVE_FOLDER_ID` bila diperlukan untuk pencatatan konfigurasi; adapter foto menggunakan file ID dari kolom `FOTO DIRI` dan memeriksa izin Drive dari server.
7. Setelah secret ditambahkan, deploy ulang Worker agar konfigurasi diterapkan. Jangan mengirimkan file JSON kepada pihak lain.
8. Uji endpoint `/api/respondents` hanya setelah login admin yang valid. Bila respons 503, periksa nama secret, ID spreadsheet, nama tab, API yang aktif, dan akses service account. Endpoint foto menggunakan `/api/photos/FILE_ID` dan hanya boleh dipanggil setelah sesi login.

Untuk mengatur ID spreadsheet dan tab lewat terminal Wrangler, gunakan:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put GOOGLE_SHEET_ID
npx wrangler secret put GOOGLE_SHEET_TAB
```

Saat diminta, masukkan isi JSON lengkap untuk secret pertama; untuk dua secret berikutnya, masukkan ID spreadsheet dan nama tab. Jika memakai Cloudflare Dashboard, buat secret/variable di sana dan jangan membuat duplikasi yang membingungkan.


Spreadsheet yang sudah ditentukan pemilik proyek:
- Spreadsheet ID: `1ISR8v6QdDVHLjWjjDO5lIjhvEG-Ukt1KSZtfjx817BQ`
- Tab: `From Response 1`
- Header nomor: `No HP/WA`
- Header foto: `FOTO DIRI`
- Google Form: `https://forms.gle/9YuWSVtgpcSed5St5`

Catatan implementasi:
- Worker mengautentikasi ke Google API dari server memakai service account.
- Worker hanya mengambil kolom yang diperlukan dan melakukan validasi header; jangan mengandalkan indeks kolom tetap jika header bisa berubah.
- URL foto Drive diperlakukan sebagai ID/link input, bukan disisipkan langsung ke halaman.
- Endpoint foto memeriksa sesi dan peran, mengambil file melalui Drive API dengan kredensial server, memeriksa tipe MIME/ukuran, lalu mengalirkan konten tanpa membuat file publik.
- Gunakan `Cache-Control: private, no-store`; jangan menulis URL foto, NIK, nomor telepon, atau isi baris ke log.
- Jangan pernah mengirim kredensial Google atau token akses ke browser.

## 7. Pengujian wajib sebelum produksi

- Password salah, akun tidak aktif, passkey salah, challenge kedaluwarsa/terpakai, Origin/RP ID salah, dan replay challenge harus ditolak.
- Pastikan rate limit login aktif; tambahkan jeda/penundaan dan alarm percobaan gagal.
- Pastikan session cookie `Secure`, `HttpOnly`, `SameSite=Strict`; session ID dirotasi setelah login; sesi dicabut saat logout dan akun dinonaktifkan.
- Pastikan petugas tidak dapat melihat data yang tidak diizinkan dengan mengubah URL/API secara manual.
- Pastikan foto Drive tidak dapat diakses dengan URL langsung oleh akun lain/tanpa sesi.
- Uji di ponsel Android dan komputer; verifikasi perilaku passkey pada masing-masing OS.
- Aktifkan backup, retensi log yang minimal, prosedur insiden, dan peninjauan akses berkala.

## 8. Jalankan lokal dan deploy

```bash
npm run dev
npm run typecheck
npm run deploy
```

Periksa `wrangler.toml` dan nama/ID database sebelum deploy. Jangan deploy ke domain publik sebelum provisioning owner dan pengujian keamanan diselesaikan.

## Catatan hukum dan privasi

Database memuat data identitas dan informasi yang dapat mengungkap kondisi kesehatan. Tetapkan dasar pemrosesan, tujuan, hak akses, retensi, penanggung jawab, dan prosedur insiden sesuai ketentuan perlindungan data pribadi serta kebijakan organisasi. Akses hanya untuk petugas yang benar-benar memerlukan.
