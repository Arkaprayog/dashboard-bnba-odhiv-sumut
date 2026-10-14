# Data Base PPKS ODHIV Sumut — secure starter

## Status keamanan

Proyek ini **belum siap untuk data responden nyata**. Dashboard operasional, pembatasan akses berbasis peran, rate limiting menyeluruh, dan alur foto privat harus diuji serta ditinjau sebelum produksi.

- Jangan pernah menyimpan rahasia di source code, `wrangler.toml`, GitHub, atau browser.
- Gunakan data sintetis untuk pengujian.
- Spreadsheet dan folder foto harus tetap privat; berikan akses service account minimum yang diperlukan.
- Jangan mencatat nama, nomor telepon, NIK, URL foto, atau isi baris responden ke log.

## Domain produksi dan baseline keamanan

- Domain kanonis: `https://sahabatodhivsumut.web.id`.
- Cloudflare memaksa HTTPS, menetapkan minimum TLS 1.2, HSTS selama enam bulan (tanpa `includeSubDomains`/`preload`), Security Level High, dan Cloudflare Managed Free Ruleset.
- Worker utama menggunakan custom domain yang dideklarasikan di `wrangler.toml`; hostname paralel `workers.dev` dinonaktifkan pada environment utama.
- API menggunakan CSP default-deny; asset menerapkan CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Cross-Origin-Resource-Policy`, dan kebijakan rujukan.
- Percobaan login tetap dibatasi di Worker per alamat IP yang di-hash. Slot Cloudflare Free untuk aturan rate-limit tambahan sudah digunakan oleh pemeriksaan kredensial bocor; jangan mengganti aturan itu tanpa tinjauan.

Pengaturan ini mengurangi paparan, tetapi **bukan sertifikasi keamanan**. Jangan gunakan data responden nyata sampai kontrol peran, seluruh endpoint, alur file/foto, backup, retensi, dan prosedur insiden ditinjau dan diuji.

## Konfigurasi Google yang benar untuk kode Worker saat ini

Kode `src/index.ts` membaca dua secret terpisah untuk autentikasi Google:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: email service account.
- `GOOGLE_PRIVATE_KEY`: private key PEM milik service account. Jika dimasukkan melalui dashboard, pertahankan format PEM; bila memakai string dengan escape, kode menormalisasi `\\n` menjadi baris baru.

Konfigurasi spreadsheet:
- `GOOGLE_SHEET_ID`: ID spreadsheet.
- `GOOGLE_SHEET_TAB`: nama tab respons, misalnya `From Response 1`.

Jangan memakai format JSON service account tunggal kecuali kode Worker terlebih dahulu diubah untuk mem-parsing format tersebut dan perubahan itu telah diuji. Jangan mengirim file kunci atau nilainya ke chat.

Untuk memasukkan secret dari terminal yang terautentikasi ke akun Cloudflare yang benar:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
```

Masukkan nilai hanya pada prompt terminal yang aman. Tambahkan ID spreadsheet dan nama tab sebagai konfigurasi server sesuai kebijakan organisasi. Jangan menaruh nilainya di frontend.

## Kontrol akses data

Sebelum endpoint responden diaktifkan untuk penggunaan operasional:
1. Batasi setiap endpoint ke peran yang memang memerlukan akses.
2. Ambil hanya kolom yang diperlukan untuk tugas pengguna, bukan seluruh rentang sumber.
3. Terapkan pagination dan batas jumlah baris.
4. Jangan mengirim data sensitif ke pengguna yang hanya perlu melihat status agregat.
5. Pastikan seluruh perubahan metadata memiliki validasi, pemeriksaan CSRF, dan audit tanpa menyimpan isi data sensitif.
6. Uji akses tanpa sesi, sesi kedaluwarsa, akun nonaktif, peran terbatas, serta percobaan login berulang.

## Deployment

Push ke `main` menjalankan validasi lalu deployment Worker otomatis bila validasi lulus; pull request hanya memvalidasi perubahan. Workflow juga dapat dijalankan secara manual melalui `workflow_dispatch`. Tambahkan `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` sebagai GitHub Actions secrets; jangan pernah menaruh token di source code atau mengirimkannya lewat chat. Gunakan token dengan izin minimum yang diperlukan.

Urutan aman:
1. Review perubahan kode dan konfigurasi.
2. Jalankan `npm install` dan `npm run typecheck`.
3. Uji dengan data sintetis di staging.
4. Verifikasi binding D1, aset, dan semua nama secret tanpa menampilkan nilainya.
5. Setelah validasi lulus, GitHub Actions menjalankan deployment dan health-check produksi.
6. Periksa versi aktif dan uji login, logout, CSRF, hak akses, dan kegagalan integrasi.

## Privasi

Data identitas dan informasi kesehatan perlu pembatasan akses, tujuan penggunaan, retensi, backup, dan prosedur insiden yang disetujui organisasi. Jangan gunakan data nyata sebelum kontrol ini selesai ditinjau.


## Android release 1.2.9

The Android module now targets release version `1.2.9` (version code `12`). The GitHub Actions workflow builds a **signed release APK**, runs Android lint and verifies the APK signature before publishing a workflow artifact.

### Required release signing setup

Before running the workflow, configure these repository-level GitHub Actions secrets under **Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded contents of the release keystore file.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: alias of the release key.
- `ANDROID_KEY_PASSWORD`: password for that key.

Generate the release keystore on a trusted device controlled by the organization and back it up securely. Never commit the keystore or passwords to the repository or send them in chat. Keep the same signing key for future APK updates; losing or replacing it can prevent existing installations from accepting updates.

After configuring the secrets, open **Actions → Build Sahabat ODHIV Sumut Android Release → Run workflow**. Download `Sahabat-ODHIV-Sumut-APK-release-v1.2.9` only after the workflow completes successfully. A workflow artifact is not proof of release readiness by itself: test installation and core flows on supported physical Android devices before wider distribution.

The current app uses local test notifications; remote push delivery is not configured until Firebase Cloud Messaging and its trusted server-side credentials are set up. Biometric, camera, gallery, offline behavior, upload flow, and privacy/access controls still require device and operational testing. Do not use real respondent health data until the access controls and data handling have been reviewed.
