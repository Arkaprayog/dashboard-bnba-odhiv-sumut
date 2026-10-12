# Catatan Versi — Dashboard BNBA ODHIV Sumut

## v1.0.7 — 12 Oktober 2026
- Menyusun ulang kontrol asesmen menjadi tiga baris: unggah Foto Diri/KTP/KK/Rumah, simpan/kosongkan beserta pilihan asesmen tersimpan, lalu cetak/simpan PDF.
- Menambahkan pratinjau gambar yang dipilih dan validasi tipe/ukuran file (maksimum 8 MB per gambar).
- Versi aplikasi dan catatan rilis disinkronkan ke 1.0.7.

## v1.0.6 — 12 Oktober 2026
- Judul halaman asesmen diselaraskan menjadi Form Asesmen Terintegrasi.
- Logo visual Kementerian Sosial ditempatkan di kiri dan logo ATENSI di kanan pada kepala lembar; tulisan ATENSI di tengah dihapus.
- Tata letak logo responsif diperbaiki untuk layar ponsel dan cetak.

## v1.0.5 — 12 Oktober 2026
- Menata ulang tampilan Form Asesmen Terintegrasi agar menyerupai dokumen formal cetak: latar putih, teks hitam, tabel berbingkai, judul terpusat, dan pemisah bagian abu-abu/krem.
- Memperbaiki konsistensi tampilan pada layar kecil dan saat cetak/PDF agar gaya dashboard biru tidak menimpa lembar asesmen.
- Versi paket dan label versi aplikasi disinkronkan ke 1.0.5.


## v1.0.4 — 12 Oktober 2026
- Menggabungkan formulir Asesmen terintegrasi dengan 91 butir, simpan/muat data asesmen melalui API, dan tabel D1 `integrated_assessments`.
- Membatasi akses endpoint asesmen ke owner/admin, memeriksa origin dan token CSRF untuk penyimpanan, serta membatasi payload maksimal 100 KB.
- Memperbarui versi tampilan dan paket menjadi 1.0.4. Deployment produksi tetap menunggu build dan verifikasi runtime yang berhasil.


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
