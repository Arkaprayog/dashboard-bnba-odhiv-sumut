# Panduan Deployment ke Cloudflare Workers

## Status Perbaikan Terbaru
- ✅ SQL queries diperbaiki (insert/update tidak lagi truncated)
- ✅ Error handling ditingkatkan untuk endpoint Google Sheets
- ✅ Validasi parameter lebih ketat
- ✅ Session logout logic lebih aman
- ✅ Type safety ditingkatkan

## Langkah Deployment

### 1. Persiapan Lokal
```bash
npm install
npm run typecheck
```

### 2. Konfigurasi Cloudflare Secrets (Jalankan sekali)
Masukkan melalui terminal yang terautentikasi ke akun Cloudflare yang benar:

```bash
# Google Service Account (format PEM)
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# Masukkan: email-service-account@project.iam.gserviceaccount.com

npx wrangler secret put GOOGLE_PRIVATE_KEY
# Masukkan: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# Konfigurasi Sheet
npx wrangler secret put GOOGLE_SHEET_ID
# Masukkan: ID dari Google Sheets (dari URL: spreadsheets/d/{ID}/...)

npx wrangler secret put GOOGLE_SHEET_TAB
# Masukkan: nama tab respons, misal "From Response 1"
```

### 3. Verifikasi Konfigurasi (jangan tampilkan nilai)
```bash
# Lihat daftar secrets yang terdaftar (tanpa nilai)
npx wrangler secret list
```

### 4. Deploy ke Production
```bash
npx wrangler deploy --env sahabatodhiv-sumut
```

### 5. Verifikasi Post-Deployment
```bash
# Test health endpoint
curl https://sahabatodhivsumut.web.id/api/health

# Harusnya mengembalikan:
# {"ok":true,"service":"sahabatodhiv-sumut","mode":"ready"}
```

## Checklist Keamanan Sebelum Deploy

- [ ] npm run typecheck lulus tanpa error
- [ ] GOOGLE_SERVICE_ACCOUNT_EMAIL sudah di-set di Cloudflare secrets
- [ ] GOOGLE_PRIVATE_KEY sudah di-set di Cloudflare secrets (format PEM lengkap)
- [ ] GOOGLE_SHEET_ID sudah di-set
- [ ] GOOGLE_SHEET_TAB sudah di-set
- [ ] APP_ORIGIN di wrangler.toml sesuai domain Worker
- [ ] D1 database binding sudah terikat di Cloudflare
- [ ] Schema SQL sudah dijalankan pada D1: `wrangler d1 execute ppks-odhiv-auth --remote --file=./schema.sql`
- [ ] Tidak ada hardcoded secrets di source code
- [ ] Test login/logout di staging terlebih dahulu
- [ ] Tidak ada sensitive data di browser console atau network logs

## Troubleshooting

### HTTP 500 Masih Muncul
1. Periksa logs Worker:
   ```bash
   npx wrangler tail --format json
   ```
2. Cari `incidentId` dari response error
3. Cocokkan dengan log untuk detail error sebenarnya

### Database D1 Error
```bash
# Jalankan schema again
wrangler d1 execute ppks-odhiv-auth --remote --file=./schema.sql

# Atau check status
wrangler d1 info ppks-odhiv-auth
```

### Google Sheets Integration Gagal
- Pastikan service account punya akses READ ke spreadsheet
- Share spreadsheet dengan email service account
- Verify GOOGLE_SHEET_ID dan GOOGLE_SHEET_TAB benar
- Check `npx wrangler tail` untuk JWT token generation errors

### CSRF Token Validation Errors
- Pastikan Origin header dari frontend cocok dengan APP_ORIGIN di wrangler.toml
- Session cookie harus HttpOnly, Secure, SameSite=Strict

## Rollback
Jika ada masalah setelah deploy:
```bash
# Deploy versi sebelumnya dari git
git checkout <previous-commit>
npm run typecheck
npx wrangler deploy
```
