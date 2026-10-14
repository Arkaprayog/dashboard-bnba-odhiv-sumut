# Integrasi Google Drive, GitHub, dan Cloudflare Worker

## Struktur folder yang dibuat oleh Worker

- **Sahabat ODHIV Sumatera Utara/**
  - **Dokumen Aplikasi/** — tempat penyimpanan dokumen aplikasi yang dikelola secara terpisah.
  - **Cadangan Proyek/** — arsip sumber dari GitHub, tanpa data responden atau database produksi.

Worker membuat folder secara idempoten menggunakan Google Drive API, lalu menyimpan ID folder di D1. Kredensial Google tetap berada di Cloudflare Worker Secrets; tidak disimpan dalam GitHub atau dikirim ke browser.

## Prasyarat Google Drive

1. Aktifkan Google Drive API di Google Cloud untuk proyek service account yang saat ini digunakan.
2. Pastikan `GOOGLE_SERVICE_ACCOUNT_EMAIL` dan `GOOGLE_PRIVATE_KEY` tersedia sebagai Cloudflare Worker secrets.
3. Service account membuat folder di Drive miliknya. Jika folder harus berada di Drive pribadi pengguna, bagikan folder tujuan kepada email service account dan implementasikan parent-folder khusus sebelum menjalankan setup.
4. Jangan masukkan data responden, NIK, foto, token, private key, file environment, atau ekspor database produksi ke cadangan source.

## Menyiapkan folder

Setelah kode ini dideploy, login ke dashboard sebagai **owner**. Dari sesi yang sama, lakukan POST ke `/api/drive/setup-folders` dengan header `X-CSRF-Token` berisi token CSRF dari `GET /api/me`. Permintaan wajib berasal dari origin aplikasi dan memakai cookie sesi owner. Endpoint mengembalikan tautan folder, bukan kredensial.

## Mengaktifkan backup GitHub otomatis

1. Buat token acak kuat minimal 32 byte. Simpan nilai yang sama sebagai secret `DRIVE_BACKUP_TOKEN` di Cloudflare Worker dan GitHub repository Actions secrets.
2. Jangan menaruh token di kode, issue, commit, file konfigurasi, atau log. Rotasi token di kedua layanan secara bersamaan.
3. Setelah secret disetel dan folder dibuat, workflow **Weekly source backup to Google Drive** akan mengarsipkan file yang dilacak Git pada jadwal mingguan atau saat dijalankan manual.
4. Arsip dibatasi maksimal 20 MiB dan diunggah melalui endpoint Worker yang memerlukan bearer secret. Workflow tidak mengarsipkan riwayat Git, data D1, atau data responden.
5. Workflow menampilkan hanya nama arsip; URL privat dan isi data tidak dicetak ke log.

## Batasan saat ini

- Folder **Dokumen Aplikasi** dibuat dan ID-nya disimpan, tetapi alur pemindahan/upload dokumen aplikasi ke folder ini belum diubah. Integrasi dokumen perlu ditambahkan per fitur setelah memutuskan jenis dokumen dan aturan akses.
- Workflow backup tidak dapat berhasil mengunggah sebelum kedua secret disetel dan folder disiapkan oleh owner.
- Google Drive API perlu tersedia untuk service account. Kegagalan dilaporkan dengan ID insiden tanpa menampilkan detail kredensial atau data sensitif.
