# Catatan Versi — Dashboard BNBA ODHIV Sumut

## v0.3.0 — 12 Oktober 2026
- Menambahkan penomoran versi aplikasi yang ditampilkan di halaman akses.
- Menetapkan kebijakan pembaruan nomor versi dan catatan perubahan.
- Menyusun menu utama: Beranda, Database, Kuesioner, Asesmen, dan Berita.
- Menu Asesmen masih berupa placeholder; formulir belum diaktifkan dan belum menyimpan data.

## Kebijakan versi
- **MAJOR** (x.0.0): perubahan besar yang dapat mengubah alur atau kompatibilitas.
- **MINOR** (0.x.0): fitur baru atau perubahan kemampuan yang terlihat pengguna.
- **PATCH** (0.0.x): perbaikan bug, keamanan, atau perubahan kecil tanpa fitur baru.

Setiap perubahan aplikasi berikutnya harus memperbarui nomor versi, catatan di bagian atas berkas ini, dan versi pada `package.json`. Nomor versi kode tidak dengan sendirinya membuktikan bahwa deployment Cloudflare berhasil; status deployment diperiksa terpisah melalui GitHub Actions.
