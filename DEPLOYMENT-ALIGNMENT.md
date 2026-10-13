# Sinkronisasi GitHub dan Cloudflare — Sahabat ODHIV Sumut

## Sumber kode dan target produksi

- Repository: `Arkaprayog/sahabatodhiv-sumut`
- Branch utama: `main`
- Worker produksi: `sahabatodhiv-sumut`
- URL: https://sahabatodhivsumut.web.id
- D1 binding: `DB` mengarah ke database `ppks-odhiv-auth`.

## Alur deployment

Workflow `.github/workflows/validate-deploy.yml` menjalankan pemeriksaan kode, pemeriksaan konfigurasi Wrangler, lalu deployment ke environment `sahabatodhiv-sumut` untuk push ke `main` atau pemicu manual. Workflow Android membangun APK debug secara terpisah ketika berkas Android berubah.

Jangan mengedit Worker langsung di Cloudflare tanpa merekonsiliasi perubahan ke repository. Perubahan kode harus masuk ke GitHub agar bisa diaudit dan dibangun ulang.

## GitHub Actions secrets

Workflow produksi membutuhkan:
- `CLOUDFLARE_API_TOKEN`: token dengan izin minimum untuk deployment Worker pada akun target.
- `CLOUDFLARE_ACCOUNT_ID`: ID akun Cloudflare.

Secret aplikasi seperti Google service account, token bootstrap, dan VAPID private key harus tetap dikelola sebagai Cloudflare Worker secrets. Jangan menaruh nilai secret di source code, `wrangler.toml`, log, issue, atau percakapan.

## Pemeriksaan sebelum dan sesudah deploy

1. Jalankan typecheck, pemeriksaan inline JavaScript, pemeriksaan konfigurasi Wrangler, dan smoke tests.
2. Pastikan nama Worker, `APP_ORIGIN`, dan `WEBAUTHN_RP_ID` mengarah ke domain Sahabat yang kanonis.
3. Pastikan deployment tidak mengganti database D1 atau menghapus secret.
4. Pastikan GitHub Actions sukses dan health check mengonfirmasi backend serta database terhubung.
5. Uji login/logout, role akses, endpoint yang memerlukan autentikasi, upload, Google Sheets, dan notifikasi menggunakan data sintetis.
6. Untuk APK, unduh artefak dari workflow Android dan uji pada perangkat nyata.

## Status dan batasan keamanan

Lulusnya build dan smoke tests tidak sama dengan audit keamanan menyeluruh. Repository sendiri mencatat bahwa aplikasi belum boleh dianggap siap untuk data responden nyata sebelum kontrol akses, pembatasan laju, privasi berkas, dan pengujian operasional ditinjau. Data ODHIV sangat sensitif; gunakan data sintetis selama validasi dan batasi akses spreadsheet/folder foto.
