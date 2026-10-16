## 1.1.48 — 2026-10-16
- Hapus seluruh latar kartu, efek blur kaca, garis dekoratif, dan bayangan dari semua panel/kartu di dashboard owner; foto latar tetap terlihat.
- Hilangkan lapisan latar pada area foto/nama/NIP/unit kerja dan tombol ikon Notifikasi, Pengaturan, serta Keluar tanpa mengubah ID atau handler.
- Tambahkan stylesheet cleanup sebagai aturan terakhir dan cache-buster baru agar perubahan tampilan tidak tertahan CSS lama.
- Perbaiki pemeriksaan versi CI yang masih mengharapkan stylesheet/versi lama; selaraskan web/PWA ke 1.1.48 dan Android ke 1.2.27 (versionCode 30).

## 1.1.47 — 2026-10-16
- Ratakan grup ikon notifikasi, pengaturan, dan keluar ke sisi kanan kartu profil menggunakan margin-left:auto tanpa mengganti ID/event handler.
- Tambahkan jam lokal real-time “Live DD/MM/YYYY HH:mm:ss” di kanan bawah kartu, warna olive green; diperbarui setiap detik dan disegarkan saat tab kembali aktif.
- Selaraskan versi web/PWA ke 1.1.47 dan Android ke 1.2.26 (versionCode 29).

## 1.1.46 — 2026-10-16
- Ratakan menu DATA ASESMEN PPKS dan FROM ASESMEN TERINTEGRASI sebagai tombol menu utama, lalu hapus menu induk “From Asesmen Terintegrasi”.
- Ganti label menjadi DATABASE PPKS, DATA ASESMEN PPKS, FROM ASESMEN TERINTEGRASI, dan KUISIONER; urutan tujuh menu serta seluruh huruf kapital mengikuti permintaan.
- Perbarui grid floating action buttons menjadi empat kolom pada layar lebar dan dua kolom pada tablet/ponsel, dengan bingkai sky blue dan hover yang ringan.
- Pertahankan batas akses menu asesmen untuk owner/admin; selaraskan versi web/PWA ke 1.1.46 dan Android ke 1.2.25 (versionCode 28).

## 1.1.45 — 2026-10-16
- Pasang aset `public/logos/app icon-template.png` sebagai favicon, Apple Touch Icon, dan ikon PWA melalui manifest.
- Tambahkan gaya CSS komponen pratinjau ikon SODARAMU yang responsif, terpusat, bersudut squircle, dan memiliki bayangan halus.
- Selaraskan versi web/PWA ke 1.1.45; versi Android native tidak diubah karena perubahan ini khusus aset web.

## 1.1.44 — 2026-10-16
- Perbaiki kegagalan cetak/simpan PDF dengan mengurai data URL foto langsung ke Uint8Array tanpa fetch(data:), yang diblokir kebijakan CSP.
- Tambahkan pesan kesalahan spesifik untuk pemuatan template PDF dan penyimpanan asesmen.
- Perbaiki pemisah baris tag stylesheet agar stylesheet dashboard single-layer benar-benar dimuat.
- Selaraskan versi web/PWA ke 1.1.44 dan Android ke 1.2.24 (versionCode 27).

## 1.1.43 — 2026-10-16
- Redesign dashboard dengan konsep single-layer glassmorphism: latar pemandangan tetap dominan dan kontainer dekoratif bertumpuk dihilangkan.
- Ubah menu utama menjadi grid Floating Action Buttons berbingkai biru langit, responsif, dan mudah diakses.
- Pertahankan ID, event handler, menu, API, dan alur data yang sudah ada; perubahan terutama pada stylesheet presentasi.
- Selaraskan versi web/PWA ke 1.1.43 dan Android ke 1.2.23 (versionCode 26).

## 1.1.41 — 2026-10-16
- Susun empat pemilih foto asesmen secara horizontal: empat kolom pada layar lebar dan dua kolom pada ponsel.
- Pindahkan tombol CETAK dan SIMPAN ke bawah lembar pengisian asesmen, di luar area cetak.
- Ganti label SIMPAN PDF menjadi SIMPAN dan hapus tombol SIMPAN ASESMEN serta KOSONGKAN FORM.
- Tombol SIMPAN menyimpan asesmen ke penyimpanan privat lalu mengunduh PDF 10 halaman; tombol CETAK tetap mencetak PDF.
- Terapkan huruf kapital pada label dan tombol tanpa mengubah kapitalisasi nilai yang diketik pengguna.
- Selaraskan versi web/PWA ke 1.1.41 dan Android ke 1.2.21 (versionCode 24).

## 1.1.40 — 2026-10-16
- Pertegas pembungkus ikon Notifikasi, Pengaturan, dan Keluar: flex satu baris, rata kanan, tidak membungkus, dan jarak 12px.
- Perjelas pemisah cetak untuk enam halaman form dan empat halaman lampiran foto pada format A4.
- Sinkronkan versi web, PWA, dan cache aset ke 1.1.40; logika autentikasi, API, dan penyimpanan asesmen tetap dipertahankan.

## 1.1.39 — 2026-10-16
- Kunci tombol Notifikasi, Pengaturan, dan Keluar pada header dalam satu baris horizontal rata kanan.
- Pertahankan ID tombol dan event handler yang sudah ada agar fungsi notifikasi, pengaturan, dan logout tidak berubah.
- Tambahkan stylesheet khusus aksi header tanpa mengubah logika API atau autentikasi.

## 1.1.38 — 2026-10-15
- Membagi dokumen asesmen saat dicetak menjadi enam halaman formulir dengan rentang nomor pertanyaan yang mengikuti PDF referensi, lalu empat halaman lampiran foto terpisah.
- Menyediakan halaman foto 7–10 meskipun foto belum diunggah; halaman tetap berurutan dan berubah menjadi foto aktual saat berkas dilampirkan.
- Menambahkan stylesheet cetak A4 khusus, mempertahankan antarmuka layar dengan Glassmorphism, dan menampilkan nilai input pada hasil cetak.
- Memperbarui nama lampiran terakhir menjadi “FOTO RUMAH TAMPAK DEPAN”.
- Versi web 1.1.38.

## 1.1.37 — 2026-10-15
- Update test otomatis agar memvalidasi teks hak cipta baru “Data Base Kemensos RI DRSKPNO”.
- Selaraskan versi web, manifest, dan cache aset ke 1.1.37.

## 1.1.36 — 2026-10-15
- Ganti teks hak cipta halaman akses awal dan footer menjadi “Data Base Kemensos RI DRSKPNO”.
- Selaraskan versi web dan cache aset ke 1.1.36.

## 1.1.35 — 2026-10-15
- Ganti nama menu Asesmen menjadi From Asesmen Terintegrasi.
- Ganti tombol CETAK / SIMPAN PDF menjadi Print; nama keluaran cetak mengikuti nama responden pada pertanyaan 16.
- Tampilkan nama responden pada daftar asesmen tersimpan agar catatan mudah dikenali.
- Sesuaikan pertanyaan 69 (bukti kepemilikan tanah) dan 70 (tinggal bersama) menjadi pilihan tunggal sesuai PDF acuan.
- Naikkan versi web dan cache aset ke 1.1.35.

## 1.1.34 — 2026-10-15
- Terapkan stylesheet glassmorphism global yang konsisten pada panel, kartu, form, tombol, tabel, dan kontrol di seluruh aplikasi.
- Hilangkan latar solid dan bayangan berat pada permukaan aplikasi; gunakan kaca transparan, blur 14px, border putih tipis, dan teks putih.
- Pertahankan logika HTML/JavaScript, handler, API, dan struktur data; pengecualian print menjaga lembar PDF tetap layak cetak.
- Selaraskan versi rilis ke 1.1.34.

## 1.1.33 — 2026-10-15
- Susun seluruh input foto dan tombol Form Asesmen Terintegrasi dalam satu kolom vertikal, dengan urutan yang jelas di ponsel maupun desktop.
- Bersihkan efek bayangan pada kontrol asesmen, pertahankan teks putih dan permukaan glass transparan, serta perbesar area pemilihan berkas.
- Selaraskan versi aplikasi, manifest PWA, cache stylesheet, dokumentasi, dan pemeriksaan rilis menjadi 1.1.33.

## 1.1.32 — 2026-10-15
- Perbaiki tampilan mobile Kuisioner Responden dan From Asesmen Terintegrasi; pastikan label pilihan dan tombol tetap terbaca horizontal.
- Sinkronkan versi web dan PWA menjadi 1.1.32; validasi versi rilis memakai nilai package.json yang aktif.

## 1.1.31 — 2026-10-15
- Perbaiki layout profil owner responsif: foto dan tombol Edit profil di kolom kiri, identitas di kanan, ikon aksi dalam baris terpisah.
- Gabungkan CSS profil ke stylesheet dashboard terpusat agar lolos pemeriksaan rilis; samakan versi web/PWA menjadi 1.1.31.
- Naikkan versi shell Android menjadi 1.2.20 (versionCode 23) agar build APK ikut terpicu.

## 1.1.30 — 2026-10-15
- Tambahkan tema transparan bersama untuk seluruh halaman HTML publik agar permukaan kartu, tabel, dan panel tidak menutupi foto latar; warna teks semantik dipertahankan demi keterbacaan.
- Memindahkan selector khusus Login dari blok CSS inline lama ke `public/login.css` agar satu sumber gaya; menyegarkan cache aset ke v1.1.39.
- Menyegarkan URL aset tema ke v1.1.38 agar rilis CSS Login tidak berbagi kunci cache dengan aset lama; health check menguji stylesheet dengan query unik dari commit.
- Menghilangkan bar status Login saat kosong, mempertahankan status saat berisi pesan, dan menyamakan nilai blur WebKit/standar.
- Memperbaiki konflik CSS spesifisitas tinggi yang memaksa teks Login biru; menambahkan uji regresi warna teks, versi manifest, dan pengiriman aset CSS Login di produksi.
- Memperbaiki halaman login agar kartu, kolom kata sandi, tombol mata, dan status keluar memakai kaca gelap transparan; teks UI putih dan latar Danau Toba tetap terlihat.
- Menyamakan panel, kartu, formulir, navigasi, menu, dan tombol lintas halaman dengan permukaan glassmorphism rgba(15, 23, 42, 0.75) dan blur 16px.
- Menyegarkan cache tema semua halaman dan layar offline Android agar perubahan visual tidak tertahan versi lama.
- Versi web 1.1.30; Android 1.2.19 (versionCode 22).

## 1.1.28 — 2026-10-14
- Menerapkan tema glassmorphism global dengan `backdrop-filter: blur(16px)`, permukaan slate `rgba(15, 23, 42, 0.75)`, dan tipografi putih pada seluruh halaman web.
- Menjaga input transparan, cache-buster background dashboard, serta keterbacaan dokumen A4 saat dicetak.
- Menambahkan pemeriksaan regresi untuk nilai blur, opasitas permukaan, dan sinkronisasi versi.

## 1.1.27 — 2026-10-14
- Mempertegas font putih secara global di seluruh halaman web dan layar offline Android.
- Menurunkan opasitas permukaan UI dan memperkuat blur glassmorphism; tombol lonceng, pengaturan, dan keluar dipastikan bulat tanpa kotak pembungkus serta ditempatkan di kanan atas.
- Memperbaiki pemeriksaan deployment agar versi cache background mengikuti `package.json`, dan menambah pemeriksaan CI untuk sinkronisasi web 1.1.27 dengan Android 1.2.17 (version code 20).

## 1.1.26 — 2026-10-14
- Memperluas glassmorphism transparan ke permukaan UI lintas halaman, termasuk form, dialog, panel, kartu, dan elemen status.
- Menegaskan font putih pada semua elemen UI dan menambahkan pengecualian cetak hitam-putih agar dokumen A4 tetap formal.
- Menyegarkan cache tema web ke 1.1.26 dan menaikkan versi Android ke 1.2.17 (version code 19).

## 1.1.25 — 2026-10-14
- Memperbaiki ambang pemeriksaan ukuran latar WebP agar menerima aset terkompresi yang valid sambil tetap memverifikasi header dan formatnya.
- Menyegarkan cache tema global ke versi 1.1.25 setelah validasi awal mendeteksi ambang uji yang terlalu tinggi.
- Menerapkan foto bukit tertanam dan glassmorphism pada halaman offline Android sehingga desain tetap konsisten tanpa koneksi.
- Versi Android native dinaikkan ke 1.2.15 (version code 18) untuk menyinkronkan rilis perbaikan.

## 1.1.24 — 2026-10-14
- Menerapkan foto bukit yang diberikan sebagai latar konsisten pada seluruh halaman aplikasi/web.
- Menyamakan font layar menjadi putih dan permukaan UI menjadi glassmorphism transparan dengan blur, termasuk form, kartu, navigasi, status, dan dokumen.
- Mempertahankan format surat resmi hitam-putih khusus pada saat cetak A4/PDF agar tetap layak sebagai dokumen kedinasan.
- Menambahkan pemeriksaan regresi untuk latar WebP, tema global setiap halaman, dan sinkronisasi versi.
- Versi Android native diselaraskan ke 1.2.13 (version code 16).

## 1.1.23 — 2026-10-14
- Menyelaraskan Surat Tugas dengan konsep Surat Lainnya: kop surat tetap dengan logo, baris tempat/tanggal di kanan, dan tata letak cetak A4.
- Menghapus pernyataan tanda tangan elektronik BSrE/BSSN yang tidak didukung oleh mekanisme tanda tangan aktual; template Surat Tugas tidak menyertakan barcode atau QR code.
- Versi web dinaikkan ke 1.1.23; versi Android native diselaraskan ke 1.2.12 (version code 15).

## 1.1.22 — 2026-10-14
- Menambahkan template Surat Tugas pada menu Dokumen berdasarkan dokumen yang diberikan.
- Teks template dapat disunting langsung, tanggal dan blok tanda tangan diratakan ke kanan, serta tersedia cetak/simpan PDF A4.
- Versi web dinaikkan ke 1.1.22; versi Android native diselaraskan ke 1.2.11 (version code 14).

## 1.1.21 — 2026-10-14
- Memindahkan baris tempat dan tanggal pada Surat Lainnya ke sisi kanan, tepat di bawah kop surat dan sebelum rincian nomor/sifat/hal, sesuai tata letak surat resmi.
- Menjaga perataan kanan pada pratinjau, tampilan ponsel, dan cetak A4/PDF.
- Versi web dinaikkan ke 1.1.21; versi Android native diselaraskan ke 1.2.10 (version code 13).

## 1.1.20 — 2026-10-14
- Mengganti panel profil owner dari biru solid menjadi kaca transparan/frosted glass agar latar belakang tetap terlihat.
- Memindahkan lonceng, pengaturan, dan keluar ke sudut kanan atas; ketiganya berbentuk lingkaran terpisah tanpa kotak pembungkus.
- Memperbesar foto profil, mempertahankan tombol Edit Profil berbentuk pil, dan menyelaraskan versi web ke 1.1.20.
- Menyelaraskan dokumentasi APK Android dengan versi native 1.2.9 (version code 12); build APK harus berhasil dan diuji sebelum dianggap terbit.

## 1.1.18 — 2026-10-14
- Menyamakan tampilan glassmorphism pada dashboard, Kelola Tim Petugas, dan Daftar Petugas dengan panel transparan dan efek blur yang tetap menjaga keterbacaan.
- Membuat tombol lonceng, pengaturan, dan keluar berbentuk lingkaran kaca transparan; tombol Edit Profil berbentuk oval memanjang.
- Menyembunyikan petugas nonaktif dari profil, pilihan petugas, dan capaian pada halaman Daftar Petugas tanpa menghapus catatan atau riwayat administrasi.
- Menyelaraskan versi web ke `1.1.18`, Android ke `1.2.8` (version code `11`), serta menambah uji regresi tampilan dan status petugas.

## 1.1.17 — 2026-10-14
- Menambahkan uji regresi untuk sinkronisasi nama/unit kerja owner, tombol profil dashboard, tema glass biru langit, dan konsistensi versi web/Android.
- Menyelaraskan metadata paket web ke `1.1.17` serta Android ke `1.2.7` (version code `10`) agar build APK berikutnya dapat dibedakan dari rilis sebelumnya.
- Memperluas validasi CI agar perubahan dashboard dan versi Android tidak kehilangan perbaikan utama secara tidak sengaja.

## 1.1.16 — 2026-10-14
- Menyelaraskan nomor versi tampilan web, paket, dan pemeriksaan deployment setelah rangkaian pembaruan 13–14 Oktober.
- Memperbaiki kontras teks dan tombol, serta memperjelas diagnosis ketika pengiriman kuesioner atau asesmen gagal.
- Memperbarui fitur Tim Kerja, profil petugas, daftar tim dan pencapaian bulanan; foto profil tim ditangani melalui penyimpanan privat.
- Memperbaiki tata letak cetak/QR Surat Lainnya dan merapikan navigasi berbasis domain HTTPS kanonis.
- Menambahkan halaman konfigurasi folder backup Google Drive khusus pemilik dan memperkeras alur arsip source. Backup Drive tetap membutuhkan token yang benar-benar dikonfigurasi dan diverifikasi.
- Memperbaiki umpan balik penyimpanan asesmen dan pemulihan foto yang tersimpan bersama jawaban.
- Menyelaraskan paket Android ke versi `1.2.6` (version code `9`) dan membangun ulang APK debug serta rilis dari sumber yang sama.

## 1.1.15 — 2026-10-14
- Membatasi tautan artikel dari RSS eksternal hanya ke URL HTTPS pada domain penerbit tepercaya Kemenkes dan ANTARA.
- Memvalidasi ulang URL di dashboard sebelum membuat tautan yang dapat diklik, termasuk menolak kredensial URL, port khusus, dan domain tiruan.
- Menambahkan pengujian regresi otomatis untuk URL yang diizinkan dan ditolak.

## 1.1.14 — 2026-10-14
- Route static asset requests through the Worker so browser security headers are applied to actual public responses.
- Extend Wrangler validation to prevent asset requests from bypassing Worker response hardening.
- Add runtime smoke checks for HSTS, CSP, X-Frame-Options, X-Content-Type-Options, and same-origin resource policy.
- Synchronize the web application and package release version.

## 1.1.13 — 2026-10-14
- Require a stronger 14-character minimum for first-time owner bootstrap passwords.
- Reworked the owner setup helper to use the canonical domain, correct Origin/token headers, and the API's camelCase body contract.
- Prompt for passwords and bootstrap tokens without putting them in CLI arguments; remove temporary request files when done.
- Corrected obsolete setup/deployment documentation and aligned CI to validate the setup helper.

## 1.1.12 — 2026-10-14
- Fixed public questionnaire links, the QR destination, and the related news link to use the canonical HTTPS domain.
- Fixed the Android offline recovery button and refreshed deployment guidance to use the canonical domain.
- Added CI checks that fail if the production dashboard or Android offline screen reintroduces the obsolete workers.dev host.
- Synchronized the displayed app version, package version, and release notes.

## 1.1.11 — 2026-10-14
- Made https://sahabatodhivsumut.web.id the canonical production hostname in Wrangler and the Android WebView.
- Disabled the parallel workers.dev hostname for the primary Worker and declared the custom domain in the deployment config.
- Hardened API and asset responses with default-deny API CSP, same-origin resource policy, and cross-domain policy restrictions.
- Enabled Cloudflare HTTPS redirects, TLS 1.2 minimum, six-month HSTS, High security level, and Cloudflare Managed Free Ruleset at the zone edge.
- Kept backend per-IP login throttling and the existing leaked-credential rule; the Cloudflare Free rate-limit phase has no extra custom-rule slot.

## 1.1.10 — 2026-10-13
- Replaced the assessment form's illustrative ministry mark with the supplied Kemensos logo and refreshed ATENSI from the user-provided logo image.
- Added an editable Surat Lainnya editor prefilled from the submitted Dinkes letter PDF, including letterhead, recipient, body, date/number fields, and print-to-PDF.
- Kept text contrast high across the login and owner dashboard; synchronized displayed and package versions.

## 1.1.9 — 2026-10-13
- Replaced low-contrast white typography with dark, high-contrast text and lighter surfaces across the login, owner dashboard, questionnaire, and loading screen.
- Preserved the Form Asesmen Terintegrasi's white print sheet, dark printable text, and local Kemensos/ATENSI logos.
- Synchronized the visible application version and package version to 1.1.9.

## 1.1.8 — 2026-10-13
- Reduced the public login card width and transparency overlay, removed backdrop blur, and strengthened text contrast.
- Hid the login heading and slogan after authentication so the owner profile is the first dashboard section.
- Added the owner Lake Toba photo as the first slide in the eight-image landing slideshow; each slide remains visible for five seconds.
- Added a deployment smoke check for the generated WebP background asset.

## 1.1.7 — 2026-10-13
- Added seven-photo Danau Toba login slideshow, advancing every second and looping while logged out.
- Pauses after authentication and resumes after logout.
- Extracts the seven supplied JPG photos from the repository ZIP during validation and deployment for same-origin asset delivery.

## 1.1.6 — 2026-10-13
- Removed the username field from the public login screen.
- Refined the compact translucent login card and centered the Kemensos logo.

# Changelog

## 1.1.5 — 2026-10-13
- Aligned the default Wrangler deployment target, health-service identity, origin, and WebAuthn RP ID with the canonical `sahabatodhiv-sumut` Worker.
- Removed the redundant manual deployment workflow so production deploys use the validated health-check workflow.
- Updated deployment and Android documentation to distinguish the signed release APK from the debug APK and document current release limitations.

## 1.0.18 — 2026-10-12
- Added a 3-second collaboration logo transition after successful password verification and before dashboard display.
- Animated orbit rings with the KOLABORASI title, Kemensos and Kemenkes logos, and HIV red ribbon; the transition closes on the Kemensos logo.

## 1.0.17 — 2026-10-12
- Corrected the public landing page proportions and spacing for mobile screens.
- Increased the visibility of the scenic Rumah Gadang background and removed the old geometric footer overlay.
- Kept the login card translucent without blur and improved text contrast.

## v1.0.16 — 12 Oktober 2026
- Menyesuaikan landing page dengan referensi: latar fotografi rumah adat Minangkabau, nuansa langit biru, serta aksen biru-hijau-kuning.
- Memusatkan logo Kemensos, mempertahankan kalimat sinergi dan judul Database ODHIV Sumatera Utara.
- Menggunakan panel login transparan tanpa blur agar teks tetap tajam.
- Menyelaraskan dashboard dengan panel terang dan tabel berkontras tinggi.

## v1.0.15 — 12 Oktober 2026
- Memusatkan logo Kemensos pada halaman login dan menyembunyikan logo instansi lain.
- Mempertahankan kalimat sinergi Kemensos, Kemenkes, dan Pemprov Sumut.
- Menyegarkan halaman login dan dashboard dengan panel transparan yang tidak menggunakan blur, agar teks tetap tajam dan terbaca.
- Menyelaraskan nomor versi tampilan dan paket.

## v1.0.14 — 12 Oktober 2026
- Menyempurnakan halaman akses awal dengan kartu putih, kontras teks yang lebih jelas, aksen biru navy, dan tata letak responsif.
- Menambahkan ringkasan akses aman, pendataan terintegrasi, dan wilayah layanan pada halaman login.
- Menjaga alur autentikasi dan tampilan dashboard setelah login tetap terpisah dari penyegaran visual halaman akses.

# Catatan Versi — Dashboard BNBA ODHIV Sumut

## v1.0.13 — 12 Oktober 2026
- Memperbaiki logo Kemensos yang gagal dimuat karena URL gambar lama tidak tersedia.
- Mengalihkan gambar lambang ke berkas PNG langsung dari Wikimedia Commons; gambar tidak dibuat ulang dengan AI.
- Menyinkronkan nomor versi aplikasi dan paket menjadi 1.0.13.


## v1.0.12 — 12 Oktober 2026
- Memperbaiki aturan grid kepala formulir asesmen pada mode cetak agar susunan logo Kemensos, lambang Sumatera Utara, judul, dan logo Kemenkes tetap konsisten di kertas A4.
- Menyinkronkan nomor versi tampilan dan paket menjadi 1.0.12.


## v1.0.11 — 12 Oktober 2026
- Mengganti logo SVG ilustratif pada halaman masuk dan kepala formulir asesmen dengan gambar logo instansi resmi.
- Menata identitas instansi: Kemensos di kiri, lambang Provinsi Sumatera Utara di kanan, dan Kemenkes di tengah di bawahnya.
- Menjaga rasio gambar dengan `object-fit: contain`, teks alternatif aksesibel, dan tata letak responsif.
- Memperbarui nomor versi aplikasi dan paket ke 1.0.11.

## v1.0.10 — 12 Oktober 2026
- Memperbaiki sintaks JavaScript pada kompresi foto: menambahkan tanda kurung penutup yang hilang agar pemeriksaan sintaks dan proses build dapat berjalan.

## v1.0.9 — 12 Oktober 2026
- Memperketat target kompresi foto agar empat lampiran dan jawaban formulir tetap berada dalam batas payload penyimpanan 1,5 MB.
- Sinkronisasi versi patch untuk perbaikan ukuran lampiran.

## v1.0.8 — 12 Oktober 2026
- Lampiran FOTO DIRI, FOTO KTP, FOTO KK, dan FOTO RUMAH dikompresi di browser lalu disimpan bersama jawaban asesmen di database D1; lampiran ikut dipulihkan saat asesmen dimuat.
- Cetak/PDF menyusun Form Asesmen Terintegrasi terlebih dahulu, kemudian satu halaman A4 untuk tiap foto dengan urutan FOTO DIRI, FOTO KTP, FOTO KK, FOTO RUMAH.
- Batas payload asesmen dinaikkan menjadi 1,5 MB untuk mendukung gambar terkompresi; pembatasan akses owner/admin, origin, dan CSRF tetap berlaku.

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
