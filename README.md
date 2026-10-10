# Data Base PPKS ODHIV Sumut — secure starter

## Status keamanan

Proyek ini **belum siap untuk data responden nyata**. Dashboard operasional, pembatasan akses berbasis peran, rate limiting menyeluruh, dan alur foto privat harus diuji serta ditinjau sebelum produksi.

- Jangan pernah menyimpan rahasia di source code, `wrangler.toml`, GitHub, atau browser.
- Gunakan data sintetis untuk pengujian.
- Spreadsheet dan folder foto harus tetap privat; berikan akses service account minimum yang diperlukan.
- Jangan mencatat nama, nomor telepon, NIK, URL foto, atau isi baris responden ke log.

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

GitHub Actions disiapkan untuk deployment manual setelah validasi. Tambahkan `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` sebagai GitHub Actions secrets; jangan pernah menaruh token di source code atau mengirimkannya lewat chat. Gunakan token dengan izin minimum yang diperlukan.

Urutan aman:
1. Review perubahan kode dan konfigurasi.
2. Jalankan `npm install` dan `npm run typecheck`.
3. Uji dengan data sintetis di staging.
4. Verifikasi binding D1, aset, dan semua nama secret tanpa menampilkan nilainya.
5. Deploy manual setelah semua pemeriksaan lulus.
6. Periksa versi aktif dan uji login, logout, CSRF, hak akses, dan kegagalan integrasi.

## Privasi

Data identitas dan informasi kesehatan perlu pembatasan akses, tujuan penggunaan, retensi, backup, dan prosedur insiden yang disetujui organisasi. Jangan gunakan data nyata sebelum kontrol ini selesai ditinjau.
