# Menyelaraskan GitHub dan Cloudflare

## Sumber kode

Repositori GitHub `Arkaprayog/dashboard-bnba-odhiv-sumut` adalah sumber kode yang harus ditinjau sebelum deployment. Jangan melakukan edit langsung di editor Worker Cloudflare tanpa kemudian menyalin perubahan yang sudah diuji kembali ke GitHub.

Worker target: `dashboard-bnba-odhiv-sumut`.

## Otomatisasi yang disiapkan

Workflow `.github/workflows/validate-deploy.yml`:
- menjalankan typecheck pada pull request ke `main`;
- menyediakan deployment produksi manual melalui GitHub Actions;
- menjalankan validasi sebelum deployment;
- tidak otomatis men-deploy setiap commit ke produksi.

Deployment memerlukan dua GitHub Actions secrets:
- `CLOUDFLARE_API_TOKEN`: token Cloudflare dengan hak minimum untuk deploy Worker di akun target;
- `CLOUDFLARE_ACCOUNT_ID`: ID akun Cloudflare target.

Jangan pernah menaruh token di source code, file konfigurasi, issue, atau log. Gunakan token yang dibatasi ke akun dan izin yang dibutuhkan.

## Sebelum menjalankan deployment produksi

1. Pastikan perubahan perbaikan HTTP 500 yang dibuat melalui Cloudflare AI sudah dipindahkan ke GitHub sebagai perubahan kode yang ditinjau. Deployment Cloudflare terbaru saja tidak membuktikan bahwa source GitHub sudah sama.
2. Jalankan typecheck dan uji alur owner/login di staging.
3. Periksa bahwa `wrangler.toml` menunjuk ke Worker dan D1 yang benar. Jangan mengganti database ID atau menjalankan migrasi remote tanpa pemeriksaan.
4. Pastikan secret Google dan binding produksi tetap ada setelah deploy.
5. Jalankan workflow manual dari GitHub Actions, lalu periksa deployment ID/versi Cloudflare dan health endpoint.
6. Uji login, logout, endpoint yang memerlukan sesi, serta penolakan akses tanpa autentikasi sebelum memakai data nyata.

## Batas saat ini

Menambahkan workflow tidak langsung menyelaraskan kode produksi. Deployment baru dapat dijalankan setelah secret GitHub Actions dikonfigurasi dan revisi kode produksi yang dibuat melalui Cloudflare AI sudah direkonsiliasi dengan source GitHub. Jangan menganggap deployment berhasil sampai GitHub Actions dan versi Worker sama-sama terverifikasi.
