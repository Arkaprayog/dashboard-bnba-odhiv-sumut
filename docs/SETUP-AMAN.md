# Panduan konfigurasi aman Cloudflare

Status: panduan setup; aplikasi belum siap untuk data responden produksi.

## 1. Buat database D1
Di Cloudflare Dashboard, buka Workers & Pages → D1 SQL Database → Create database. Gunakan nama ppks-odhiv-auth. Salin Database ID.

## 2. Hubungkan D1
Edit wrangler.toml: ganti GANTI_DENGAN_DATABASE_ID dengan ID database D1 yang benar. Atur APP_ORIGIN ke URL Worker yang sebenarnya tanpa garis miring di akhir. Atur WEBAUTHN_RP_ID ke hostname yang sama jika kelak mengaktifkan passkey.

Jangan menambahkan password, token bootstrap, private key, atau isi JSON service account ke file ini.

## 3. Jalankan migrasi
Jalankan SQL dari schema.sql pada database D1 yang dibuat (Cloudflare Dashboard → D1 → database → Console, atau Wrangler CLI: npx wrangler d1 execute ppks-odhiv-auth --remote --file=./schema.sql). Pastikan semua tabel dibuat tanpa error.

## 4. Siapkan secret bootstrap satu kali
Buat token acak minimal 32 karakter menggunakan password manager atau generator aman. Tambahkan sebagai Worker secret bernama OWNER_BOOTSTRAP_TOKEN melalui Cloudflare Dashboard → Workers & Pages → worker → Settings → Variables and Secrets. Jangan simpan token itu di GitHub, Google Sheet, atau chat.

Endpoint POST /api/setup-owner memerlukan header X-Owner-Bootstrap-Token dan body JSON dengan username, displayName, dan password (minimal 14 karakter). Kirim hanya dari alat admin lokal tepercaya ke domain HTTPS yang benar. Jangan menaruh token di URL atau halaman HTML. Endpoint ini hanya bekerja jika tabel admins masih kosong.

Setelah akun owner dibuat:
1. Hapus secret OWNER_BOOTSTRAP_TOKEN dari konfigurasi Worker.
2. Pastikan endpoint setup menjawab tidak aktif/503.
3. Uji login, GET /api/me, dan logout di HTTPS.
4. Pastikan data responden masih tidak dapat diakses; endpoint data sengaja tetap ditutup.

## 5. Catatan penting sebelum deploy
- Pastikan Worker dan aset statis memakai nama/binding yang sesuai di wrangler.toml.
- Lakukan deploy hanya setelah ID D1, origin, dan binding diverifikasi.
- Login saat ini belum memiliki rate limiting; tambahkan pembatasan percobaan login sebelum pemakaian nyata.
- Integrasi Google Sheets/Drive belum dibuat. Jangan masukkan service-account JSON atau data nyata.
- Repo publik saat ini berarti source code dapat dilihat publik. Jangan pernah menyimpan rahasia atau data pribadi di repo; pertimbangkan menjadikannya private.
- Jangan gunakan aplikasi ini untuk data ODHIV asli sebelum penilaian keamanan, kontrol akses berbasis peran, pembatasan foto privat, audit, backup, dan uji pemulihan selesai.
