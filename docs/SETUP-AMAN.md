# Panduan setup dan operasional aman — Sahabat ODHIV Sumut

Status: domain produksi, Cloudflare Worker, dan database D1 sudah terhubung. Pemeriksaan deployment terbaru berhasil memverifikasi health endpoint, halaman publik, aset utama, serta penolakan akses tanpa sesi. Ini bukan sertifikasi keamanan; **jangan gunakan data kesehatan/identitas responden nyata sebelum tinjauan akses, privasi, retensi, backup, dan prosedur insiden diselesaikan oleh pihak berwenang.**

## 1. Domain dan konfigurasi produksi

- Domain utama: `https://sahabatodhivsumut.web.id`.
- Worker produksi: `sahabatodhiv-sumut`, dengan binding D1 `DB`.
- Konfigurasi produksi menggunakan `APP_ORIGIN=https://sahabatodhivsumut.web.id` dan `WEBAUTHN_RP_ID=sahabatodhivsumut.web.id`.
- Cloudflare sudah dikonfigurasi untuk HTTPS, minimum TLS 1.2, HSTS enam bulan, Security Level High, dan Managed Free Ruleset.
- Jangan mengubah database ID atau nama binding produksi kecuali sedang melakukan migrasi yang direncanakan dan telah diverifikasi.

## 2. Setup owner satu kali

Endpoint bootstrap hanya terbuka ketika tabel admin kosong dan secret Worker `OWNER_BOOTSTRAP_TOKEN` tersedia. Jangan membuat token di frontend, menaruhnya pada URL, atau mengirimkannya lewat chat.

1. Buat token acak minimal 32 karakter dari password manager atau generator aman.
2. Tambahkan token sebagai **Worker secret** bernama `OWNER_BOOTSTRAP_TOKEN` melalui dashboard Cloudflare.
3. Dari komputer tepercaya yang sudah memiliki `curl`, `jq`, dan `python3`, jalankan:
   ```bash
   ./scripts/setup-admin.sh operator "Nama Admin"
   ```
4. Masukkan password owner melalui prompt tersembunyi. Gunakan minimal 14 karakter, dengan angka dan simbol. Masukkan token bootstrap pada prompt tersembunyi apabila variabel lingkungan `OWNER_BOOTSTRAP_TOKEN` belum disediakan.
5. Setelah pembuatan owner berhasil, **hapus secret `OWNER_BOOTSTRAP_TOKEN` dari Worker**. Jangan menjalankan query penghapusan admin untuk membuka setup ulang.
6. Pastikan `GET /api/setup-status` melaporkan `setupOpen: false`. Jika secret masih ada, `POST /api/setup-owner` ditolak karena akun telah dibuat (HTTP 409); setelah secret dihapus, permintaan tanpa token ditolak (HTTP 403).

Skrip tidak meminta password melalui argumen CLI, tidak mencetak token, tidak menyimpan kredensial secara permanen, dan tidak menghapus data jika pemeriksaan gagal.

## 3. Password dan akses

- Endpoint bootstrap mensyaratkan password 14-1024 karakter dengan angka dan simbol. Username 3-64 karakter.
- Worker menerapkan pembatasan percobaan login per IP yang disimpan sebagai hash; aturan Cloudflare untuk pemeriksaan kredensial bocor juga aktif. Perlindungan ini tidak menggantikan pemantauan dan pengujian.
- Jangan gunakan password yang dipakai di layanan lain. Aktifkan passkey hanya setelah pengujian registrasi, login, pencabutan, dan pemulihan berhasil.
- Uji sesi kedaluwarsa, akun nonaktif, token CSRF salah, akses role `staff`, dan permintaan tanpa autentikasi sebelum pemakaian operasional.

## 4. Google Sheets dan Google Drive

Kode Worker membaca secret terpisah:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_TAB`

Service account harus diberi izin minimum yang diperlukan pada spreadsheet dan folder Drive privat. Integrasi yang ada tetap harus diuji dengan data sintetis terlebih dahulu. Jangan memasukkan JSON service account, isi spreadsheet, NIK, nomor telepon, foto, atau data kesehatan ke repo, log, atau percakapan. Jangan membuat folder/berkas responden menjadi publik untuk memudahkan akses.

## 5. Migrasi database

Database produksi sudah dikonfigurasi. Jangan membuat database baru atau menjalankan penghapusan tabel untuk memperbaiki login. Untuk lingkungan baru, buat D1 tersendiri, cek database ID dan binding, lalu terapkan `schema.sql` setelah meninjau skema. Setiap perubahan skema produksi harus mempunyai backup yang layak dan rencana rollback.

## 6. Deployment dan pemeriksaan

Push ke `main` menjalankan validasi GitHub Actions lalu deployment Worker bila validasi lolos; workflow juga menyediakan pemicu manual. Pull request hanya memvalidasi perubahan. Setelah deployment, periksa health check, halaman publik, aset penting, serta endpoint API yang harus memerlukan autentikasi.

Simpan `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, secret Google, dan secret signing Android hanya di tempat secret yang sesuai. Gunakan izin minimum dan rotasi token jika diduga terekspos.

## 7. Batas penggunaan data

Sebelum memproses data responden nyata, organisasi harus menyelesaikan tinjauan perlindungan data, dasar/tujuan pemrosesan, pembatasan role dan kolom, privasi foto, audit, retensi/penghapusan, backup/pemulihan, respons insiden, serta pengujian keamanan yang terdokumentasi. Gunakan data sintetis sampai tinjauan tersebut selesai.
