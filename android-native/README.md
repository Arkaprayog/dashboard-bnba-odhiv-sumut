# BNBA ODHIV Sumut — Android native starter

Versi awal: **0.1.0**. Project ini dibuat dengan Kotlin dan Jetpack Compose untuk dikembangkan dari repositori GitHub; build APK dapat dijalankan melalui GitHub Actions tanpa komputer lokal.

## Fitur saat ini
- Layar beranda native Android.
- Tombol membuka dashboard produksi dan halaman kuisioner melalui Chrome Custom Tabs.
- Tidak menyimpan kata sandi atau data responden secara lokal.
- Hanya HTTPS; backup aplikasi dinonaktifkan.

## Build APK dari GitHub Actions
Workflow `.github/workflows/android-native-build.yml` akan membangun debug APK untuk commit pada folder `android-native/` dan mengunggah APK sebagai artifact.

## Batasan MVP
Ini belum menggantikan autentikasi web dengan login native dan belum mengaktifkan Firebase Cloud Messaging (FCM). Notifikasi native membutuhkan konfigurasi Firebase untuk aplikasi Android serta integrasi backend yang aman. Jangan memasukkan service-account key, token API, atau data responden nyata ke source code maupun APK.

Package: `id.arkaprayoga.ppksodhivsumut`
