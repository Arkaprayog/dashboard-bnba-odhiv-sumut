# Catatan keamanan dan privasi — Sahabat ODHIV Sumut

Dokumen ini menggambarkan perilaku kode yang ada, bukan sertifikasi keamanan atau pernyataan kepatuhan. Aplikasi menangani kemungkinan data identitas dan kesehatan yang sensitif. Jangan gunakan data responden nyata sebelum tinjauan keamanan, privasi, akses peran, retensi, backup, pemulihan, dan prosedur insiden disetujui organisasi.

## Status produksi yang terverifikasi

- Domain utama: https://sahabatodhivsumut.web.id.
- Cloudflare Worker: sahabatodhiv-sumut, binding database D1: DB.
- Baseline Cloudflare yang terkonfigurasi: HTTPS selalu aktif, minimum TLS 1.2, HSTS enam bulan, Security Level High, dan Cloudflare Managed Free Ruleset.
- GitHub Actions memeriksa TypeScript, sintaks JavaScript inline, sebagian kontrak keamanan/aset, konfigurasi Wrangler melalui dry-run, lalu memeriksa health endpoint, halaman publik, beberapa aset, serta endpoint yang harus terproteksi setelah deployment.
- Pemeriksaan otomatis tidak menggantikan pengujian penetrasi, tinjauan kode independen, uji perangkat nyata, atau persetujuan organisasi untuk memakai data nyata.

## Autentikasi dan sesi

- Login saat ini hanya menerima password, bukan username. Worker membandingkan password terhadap akun admin aktif dan menolak jika password yang sama cocok dengan lebih dari satu akun. Ini merupakan keterbatasan desain: setiap akun harus memiliki password yang kuat dan unik; autentikasi berbasis username/identitas akun akan lebih jelas jika dirancang dan diuji sebagai perubahan terpisah.
- Pembuatan owner pertama mewajibkan password 14-1024 karakter yang mengandung angka dan simbol. Perubahan password mewajibkan minimal 12 karakter yang mengandung huruf besar, huruf kecil, angka, dan simbol.
- Password disimpan sebagai hash PBKDF2-SHA256 dengan salt acak 16 byte, 100.000 iterasi, dan hasil 32 byte. Jangan menaikkan parameter hanya di dokumentasi; upgrade perlu strategi verifikasi/migrasi dan pengujian kompatibilitas agar akun lama tidak terkunci.
- Token sesi acak 32 byte; database menyimpan hash SHA-256, bukan token sesi mentah. Cookie memakai HttpOnly, Secure, SameSite=Strict, dan Path=/.
- Default TTL sesi 8 jam, dibatasi minimal 15 menit dan maksimal 8 jam. Token CSRF acak 24 byte dikembalikan setelah login dan diperiksa melalui header X-CSRF-Token pada operasi yang mengubah data.
- Worker membatasi 10 kegagalan login selama 15 menit berdasarkan hash SHA-256 dari alamat IP Cloudflare. Aturan Cloudflare leaked-credential check juga aktif. Ini bukan proteksi menyeluruh terhadap seluruh jenis abuse.

## Bootstrap owner satu kali

- POST /api/setup-owner harus berasal dari Origin yang diizinkan dan membutuhkan secret Worker OWNER_BOOTSTRAP_TOKEN.
- Pembuatan owner hanya diizinkan jika tabel admin masih kosong.
- Gunakan scripts/setup-admin.sh untuk meminta password dan token secara tersembunyi; skrip memeriksa status setup, memakai domain utama secara default, mengirim Origin dan header token yang benar, lalu membersihkan berkas permintaan sementara.
- Setelah owner dibuat, hapus secret OWNER_BOOTSTRAP_TOKEN secara manual dari konfigurasi Worker. Jangan menghapus admin langsung dari database hanya untuk membuka ulang setup.

## Hak akses dan data responden

Worker melakukan pemeriksaan sesi, CSRF, dan pemeriksaan peran pada endpoint tertentu. Endpoint asesmen, daftar responden, foto responden, dan berkas responden secara eksplisit membatasi akses ke peran owner atau admin. Jangan menyimpulkan bahwa semua endpoint memiliki aturan peran yang sama: setiap route baru atau perubahan route wajib ditinjau dan diuji untuk owner, admin, staff, akun nonaktif, sesi kedaluwarsa, dan permintaan tanpa sesi.

- File/foto melalui Google Drive dibatasi pada tipe berkas yang ditentukan dan batas ukuran 8 MB untuk rute berkas.
- Google Sheets dan Drive harus tetap privat. Beri service account akses minimum yang diperlukan; jangan menjadikan file/folder foto publik.
- Respons API sensitif memakai Cache-Control: no-store; header lain termasuk X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: no-referrer, Permissions-Policy, Cross-Origin-Resource-Policy, dan CSP.
- CSP aset masih mengizinkan skrip inline karena halaman dashboard mengandung JavaScript inline. Ini bukan konfigurasi CSP paling ketat; penggunaan nonce/hash memerlukan refaktor dan pengujian khusus.
- Jangan tulis NIK, nomor telepon, baris spreadsheet, isi foto, password, token, atau private key ke log, repository, issue publik, atau percakapan.

## Integrasi Google

Worker membaca secret terpisah:
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PRIVATE_KEY (private key PEM, bukan file JSON service account utuh)
- GOOGLE_SHEET_ID
- GOOGLE_SHEET_TAB

Kode mengautentikasi service account dan membaca/menulis data sesuai rute yang tersedia. Keberhasilan HTTP tidak membuktikan izin Google Drive/Sheets sudah benar atau bahwa batas akses bisnis sudah memadai. Uji dengan data sintetis, verifikasi ACL spreadsheet/folder, dan pastikan tidak ada file publik sebelum memakai data nyata.

## Audit, log, dan pemulihan

- Audit log menyimpan action dan metadata admin yang disediakan kode; jangan anggap seluruh pembacaan data atau setiap kegagalan sudah diaudit.
- Log insiden aplikasi membatasi konteks ke daftar field yang diizinkan, untuk menghindari menyimpan isi error/provider yang mungkin berisi data sensitif. Meski begitu, pemilik harus meninjau konfigurasi observability dan akses log.
- Tetapkan jadwal backup, uji pemulihan D1 dan dokumen pendukung, batas retensi/penghapusan, serta prosedur insiden sebelum data nyata masuk.
- Bila secret diduga bocor, rotasi Cloudflare API token, kredensial service account Google, bootstrap token, atau kunci push yang relevan melalui prosedur yang disetujui; cabut sesi yang terdampak dan periksa audit/log.

## Daftar uji sebelum penggunaan data nyata

- [ ] Uji login salah berulang, password unik antar akun, perubahan password, logout, dan kedaluwarsa sesi.
- [ ] Uji Origin/CSRF yang salah, akun nonaktif, akses setiap route oleh setiap role, dan permintaan tanpa sesi.
- [ ] Tinjau setiap route yang membaca atau mengubah data responden, status workflow, asesmen, foto, atau berkas.
- [ ] Verifikasi spreadsheet dan folder Drive privat, izin service account minimum, dan tidak ada URL/file sensitif di log atau respons yang tidak perlu.
- [ ] Uji retensi, backup/pemulihan, akses log, dan prosedur insiden.
- [ ] Jalankan pemindaian keamanan yang terkontrol dan lakukan review independen sebelum persetujuan produksi untuk data nyata.

## Pelaporan masalah

Laporkan kerentanan secara privat kepada maintainer yang bertanggung jawab, sertakan langkah reproduksi minimal dan jangan lampirkan data responden asli, password, atau secret. Hindari publikasi detail yang memungkinkan eksploitasi sebelum perbaikan tersedia.
