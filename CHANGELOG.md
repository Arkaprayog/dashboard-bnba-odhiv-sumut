# Catatan Versi — Dashboard BNBA ODHIV Sumut

## v1.0.3 — 12 Oktober 2026
- Menetapkan jalur deployment GitHub Actions khusus Worker aktif `sahabatodhiv-sumut` agar tidak salah menerbitkan ke Worker dashboard lain.
- Deployment otomatis menjalankan build TypeScript dan menggunakan environment Wrangler `sahabatodhiv-sumut` yang terikat ke D1 produksi yang sudah dikonfigurasi.
- Mempertahankan menu Asesmen sebagai placeholder sampai formulir dan validasi penyimpanan lolos pengujian; tidak mengaktifkan fitur yang belum terverifikasi.
- Catatan: workflow memerlukan GitHub Actions secrets `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`.

## v1.0.2 — 12 Oktober 2026
- Menata ulang header profil: foto dan tombol Edit profil di sisi kiri, tombol notifikasi dan Keluar di sisi kanan.
- Menyembunyikan judul “Dashboard” dan teks sesi “Masuk sebagai … · Peran: …” dari tampilan setelah login.
- Tidak mengubah isi maupun alur Beranda.

## v1.0.1 — 12 Oktober 2026
- Memperbaiki rate limit login agar percobaan gagal dibatasi berdasarkan hash IP klien, bukan satu kunci global yang dapat menghambat semua admin.
- Menyelaraskan dokumentasi keamanan dengan implementasi PBKDF2 yang saat ini digunakan; belum mengubah format hash akun yang sudah ada.
- Pembaruan patch ini tidak mengaktifkan Asesmen atau mengubah tampilan Beranda.

## v1.0.0 — 12 Oktober 2026
- Menetapkan nomor versi utama aplikasi menjadi v1.0.0.
- Menampilkan nomor versi pada halaman akses.
- Menu utama: Beranda, Database, Kuesioner, Asesmen, dan Berita.
- Menu Asesmen masih berupa placeholder; formulir belum diaktifkan dan belum menyimpan data.
- **Catatan kesiapan:** penetapan nomor versi bukan sertifikasi keamanan atau bukti bahwa seluruh fitur sudah lolos uji produksi. Validasi keamanan, alur data sensitif, integrasi, dan deployment tetap harus diperiksa sebelum aplikasi dipakai untuk mengelola data responden nyata.

## Kebijakan versi
- **MAJOR** (x.0.0): perubahan besar yang dapat mengubah alur atau kompatibilitas.
- **MINOR** (0.x.0): fitur baru atau perubahan kemampuan yang terlihat pengguna.
- **PATCH** (0.0.x): perbaikan bug, keamanan, atau perubahan kecil tanpa fitur baru.

Setiap perubahan aplikasi berikutnya harus memperbarui nomor versi, catatan di bagian atas berkas ini, dan versi pada `package.json`. Nomor versi kode tidak dengan sendirinya membuktikan bahwa deployment Cloudflare berhasil; status deployment diperiksa terpisah melalui GitHub Actions.
