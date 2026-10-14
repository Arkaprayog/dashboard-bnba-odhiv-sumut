# Integrasi Google Drive, GitHub, dan Cloudflare Worker

## Struktur folder yang dibuat oleh Worker

- **Sahabat ODHIV Sumatera Utara/**
  - **Dokumen Aplikasi/** — tempat penyimpanan dokumen aplikasi yang dikelola secara terpisah.
  - **Cadangan Proyek/** — arsip sumber dari GitHub, tanpa data responden atau database produksi.

Worker membuat folder secara idempoten menggunakan Google Drive API, lalu menyimpan ID folder di D1. Kredensial Google tetap berada di Cloudflare Worker Secrets; tidak disimpan dalam GitHub atau dikirim ke browser.

## Prasyarat Google Drive

1. Aktifkan Google Drive API di Google Cloud untuk proyek service account yang saat ini digunakan.
2. Pastikan `GOOGLE_SERVICE_ACCOUNT_EMAIL` dan `GOOGLE_PRIVATE_KEY` tersedia sebagai Cloudflare Worker secrets.
3. **Gunakan Shared Drive untuk backup otomatis.** Service account tidak memiliki kuota penyimpanan My Drive pribadi; upload dapat gagal dengan `storageQuotaExceeded`. Buat atau gunakan Shared Drive organisasi, tambahkan email service account sebagai anggota dengan peran **Contributor** atau **Content manager**, lalu buat folder tujuan **Cadangan Proyek** di dalam Shared Drive.
4. Tambahkan Worker variable `GOOGLE_DRIVE_BACKUP_FOLDER_ID` berisi ID folder **Cadangan Proyek** di Shared Drive. Ambil ID dari URL folder Drive (bagian setelah `/folders/`). ID ini wajib; backup tidak lagi memakai ID folder lama di D1 sebagai fallback. Worker memverifikasi bahwa tujuan benar-benar berada di Shared Drive aktif dan service account memiliki izin menambahkan file sebelum upload. Jangan tempelkan ID/kredensial privat ke chat.
5. Jangan masukkan data responden, NIK, foto, token, private key, file environment, atau ekspor database produksi ke cadangan source.

## Menyiapkan folder

Setelah kode ini dideploy, login ke dashboard sebagai **owner**. Dari sesi yang sama, lakukan POST ke `/api/drive/setup-folders` dengan header `X-CSRF-Token` berisi token CSRF dari `GET /api/me`. Permintaan wajib berasal dari origin aplikasi dan memakai cookie sesi owner. Endpoint mengembalikan tautan folder, bukan kredensial.

## Mengaktifkan backup GitHub otomatis

1. Buat token acak kuat minimal 32 byte. Simpan nilai yang sama sebagai secret `DRIVE_BACKUP_TOKEN` di Cloudflare Worker dan GitHub repository Actions secrets.
2. Jangan menaruh token di kode, issue, commit, file konfigurasi, atau log. Rotasi token di kedua layanan secara bersamaan.
3. Konfigurasikan `GOOGLE_DRIVE_BACKUP_FOLDER_ID` ke ID folder tujuan di Shared Drive dan pastikan service account adalah anggota Shared Drive. Folder yang dibuat pada My Drive milik service account tidak cukup untuk backup karena kuota service account.
4. Setelah kedua secret dan folder Shared Drive disiapkan, workflow **Weekly source backup to Google Drive** mengarsipkan file yang dilacak Git pada jadwal mingguan atau saat dijalankan manual.
5. Arsip dibatasi maksimal 20 MiB dan diunggah melalui endpoint Worker yang memerlukan bearer secret. Workflow tidak mengarsipkan riwayat Git, data D1, atau data responden.
6. Sebelum upload, workflow memanggil `/api/drive/backup/status` untuk memeriksa autentikasi, Shared Drive, serta izin menambahkan file. Workflow menyimpan salinan pemulihan sementara sebagai artifact GitHub Actions dengan masa simpan 30 hari. Jika upload Google Drive gagal, workflow tetap berstatus gagal (agar kegagalan tidak tersembunyi), tetapi arsip masih dapat diambil dari artifact run selama masa simpan tersebut. URL folder privat, token, dan isi data tidak dicetak ke log.

## Batasan saat ini

- Folder **Dokumen Aplikasi** dibuat dan ID-nya disimpan, tetapi alur pemindahan/upload dokumen aplikasi ke folder ini belum diubah. Integrasi dokumen perlu ditambahkan per fitur setelah memutuskan jenis dokumen dan aturan akses.
- Workflow backup tidak dapat berhasil mengunggah sebelum kedua secret tersedia, `GOOGLE_DRIVE_BACKUP_FOLDER_ID` berisi ID folder di Shared Drive, serta service account memiliki izin tulis. Status endpoint memeriksa syarat ini sebelum upload.
- Google Drive API perlu tersedia untuk service account. Kegagalan dilaporkan dengan ID insiden tanpa menampilkan detail kredensial atau data sensitif.
