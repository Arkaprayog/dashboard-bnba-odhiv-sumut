# Catatan Versi — Dashboard BNBA ODHIV Sumut

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
