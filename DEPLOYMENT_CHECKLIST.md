# Deployment & Login System Debugging Checklist

Dokumen ini berisi langkah-langkah untuk mem-verify dan men-debug sistem login di environment Cloudflare Workers.

## 1. Pre-Deployment Verification

### 1.1 Validasi Kode Lokal

```bash
# Install dependencies
npm install

# Type checking
npm run typecheck

# Build
npm run build
```

Pastikan tidak ada error pada step ini.

### 1.2 Verifikasi Environment Variables

```bash
# Cek wrangler.toml untuk:
# - APP_ORIGIN harus sesuai domain worker aktif
# - WEBAUTHN_RP_ID harus match dengan domain
# - DATABASE BINDING (DB) sudah terdaftar

cat wrangler.toml | grep -A 5 "d1_databases"
cat wrangler.toml | grep "APP_ORIGIN\|WEBAUTHN_RP_ID"
```

**Expected Output:**
```
[[d1_databases]]
binding = "DB"
database_name = "ppks-odhiv-auth"
database_id = "c0b05571-c0ac-48a7-ac58-d600f7c7e5cb"

APP_ORIGIN = "https://sahabatodhiv-sumut.aryprayoga139.workers.dev"
WEBAUTHN_RP_ID = "sahabatodhiv-sumut.aryprayoga139.workers.dev"
```

### 1.3 Verifikasi Secrets di Cloudflare

Secrets harus sudah di-set di dashboard Cloudflare atau via CLI:

```bash
# Cek secrets (hanya nama, tidak nilai)
# Di Cloudflare Dashboard: Workers & Pages > Settings > Secrets

# Jika belum ada, set sekarang:
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
```

**Expected Secrets:**
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

---

## 2. Database Setup & Schema Migration

### 2.1 Cek Database Binding di Remote

```bash
# List semua D1 databases
wrangler d1 list
```

**Expected:** Database `ppks-odhiv-auth` (ID: `c0b05571-c0ac-48a7-ac58-d600f7c7e5cb`) harus ada.

### 2.2 Jalankan Schema Migration

```bash
# Migrate schema ke remote D1 database
npm run db:migrate:remote
```

**Expected Output:**
```
✓ Executed schema.sql successfully
```

Jika error, cek:
- Database ID di `wrangler.toml` sudah benar?
- Koneksi Cloudflare sudah authenticated?

### 2.3 Verifikasi Schema di Database

```bash
# Query untuk cek apakah tabel sudah ada
wrangler d1 execute ppks-odhiv-auth --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

**Expected Output:**
```
┌─────────────────────┐
│ name                │
├─────────────────────┤
│ admins              │
│ auth_challenges     │
│ audit_log           │
│ login_attempts      │
│ passkeys            │
│ respondent_workflow │
│ sessions            │
└─────────────────────┘
```

Jika ada error atau tabel tidak lengkap, jalankan ulang: `npm run db:migrate:remote`

---

## 3. Deploy Worker

### 3.1 Build & Deploy

```bash
# Build
npm run build

# Deploy ke environment default (production)
npm run deploy
```

**Expected Output:**
```
✓ Uploaded default/ (XX files)
✓ Deployed to https://sahabatodhiv-sumut.aryprayoga139.workers.dev
```

### 3.2 Verifikasi Deployment Status

```bash
# Cek apakah worker sudah aktif
curl -s https://sahabatodhiv-sumut.aryprayoga139.workers.dev/api/setup-status | jq .
```

**Expected Response:**
```json
{
  "ok": true,
  "setupOpen": false,
  "adminsCount": 0
}
```

Atau jika admin belum dibuat:
```json
{
  "ok": true,
  "setupOpen": true,
  "adminsCount": 0
}
```

---

## 4. Create Admin Owner

### 4.1 Cek Setup Status

Jika `setupOpen: true`, jalankan setup untuk membuat owner account:

```bash
# Setup dengan curl
curl -X POST https://sahabatodhiv-sumut.aryprayoga139.workers.dev/api/setup-owner \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "display_name": "Admin PPKS",
    "password": "SecurePassword123456!"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "message": "Owner account created successfully",
  "admin": {
    "id": "admin-xxx",
    "username": "admin",
    "display_name": "Admin PPKS",
    "role": "owner"
  }
}
```

### 4.2 Verifikasi Admin Terbuat

```bash
# Query tabel admins
wrangler d1 execute ppks-odhiv-auth --remote --command "SELECT id, username, display_name, role, active FROM admins;"
```

**Expected Output:**
```
┌───────────────┬──────────┬─────────────────┬───────┬────────┐
│ id            │ username │ display_name    │ role  │ active │
├───────────────┼──────────┼─────────────────┼───────┼────────┤
│ admin-xxx     │ admin    │ Admin PPKS      │ owner │ 1      │
└───────────────┴──────────┴─────────────────┴───────┴────────┘
```

---

## 5. Test Login via Dashboard

### 5.1 Akses Dashboard di Browser

1. Buka: `https://sahabatodhiv-sumut.aryprayoga139.workers.dev`
2. Masukkan:
   - **Username:** `admin`
   - **Password:** (password yang Anda set di step 4.1)
3. Klik "Masuk"

### 5.2 Expected Behavior

- ✅ Form login menerima username + password
- ✅ Setelah login, form hilang dan dashboard muncul
- ✅ Welcome message menampilkan "Masuk sebagai Admin PPKS · Peran: owner"
- ✅ Username & password field dikosongkan
- ✅ "Muat data responden" button tersedia

### 5.3 Jika Login Gagal

#### Error: "Login gagal (HTTP 401)"
```bash
# Cek apakah password hash sudah dibuat dengan benar
wrangler d1 execute ppks-odhiv-auth --remote --command "SELECT username, password_hash FROM admins WHERE username='admin';"
```

Jika `password_hash` kosong atau NULL, hash belum digenerate. Jalankan reset:
```bash
# Delete admin dan buat ulang
wrangler d1 execute ppks-odhiv-auth --remote --command "DELETE FROM admins WHERE username='admin';"

# Setup ulang admin
curl -X POST https://sahabatodhiv-sumut.aryprayoga139.workers.dev/api/setup-owner \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "display_name": "Admin PPKS",
    "password": "SecurePassword123456!"
  }'
```

#### Error: "Tidak dapat menghubungi server"
- Cek browser console (F12 > Console) untuk CORS error
- Verifikasi APP_ORIGIN di wrangler.toml sesuai dengan domain aktif
- Jika menggunakan custom domain, update APP_ORIGIN dan APP_ORIGIN di code

#### Error: "Respons server tidak valid"
```bash
# Test endpoint login langsung via curl
curl -X POST https://sahabatodhiv-sumut.aryprayoga139.workers.dev/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "SecurePassword123456!"
  }' | jq .
```

Cek response JSON untuk error message.

---

## 6. Test Additional Features

### 6.1 Test /api/me (Check Session)

```bash
# Setelah login, get session cookie dan test
curl -b "cookies.txt" -c "cookies.txt" \
  -X GET https://sahabatodhiv-sumut.aryprayoga139.workers.dev/api/me \
  -H "Cookie: $(cat cookies.txt | grep -oP 'session_id\s+\K.*')" | jq .
```

Expected: Admin data kembali dengan session valid.

### 6.2 Test Logout

```bash
# Dari browser: Klik tombol "Keluar"
# Atau via curl dengan CSRF token dari respons login sebelumnya

curl -X POST https://sahabatodhiv-sumut.aryprayoga139.workers.dev/api/logout \
  -H "X-CSRF-Token: <csrf_token_dari_login>" \
  -H "Content-Type: application/json" | jq .
```

Expected: `{"ok": true}` dan session hilang.

### 6.3 Test Google Sheets Integration (Jika Sudah Setup)

```bash
# Test respondent data fetch
curl -X GET https://sahabatodhiv-sumut.aryprayoga139.workers.dev/api/respondents \
  -H "Cookie: $(cat cookies.txt)" | jq .
```

Expected: Array data responden atau error yang jelas jika Google Sheets belum terhubung.

---

## 7. Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Database binding error` | D1 tidak terikat ke worker | Verifikasi `binding = "DB"` di wrangler.toml |
| `FOREIGN KEY constraint failed` | Schema belum di-migrate | Jalankan `npm run db:migrate:remote` |
| `CORS origin mismatch` | APP_ORIGIN tidak sesuai domain | Update APP_ORIGIN di wrangler.toml |
| `Incorrect origin` | Browser origin ≠ APP_ORIGIN | Akses via domain yang benar, bukan IP/localhost |
| `Setup endpoint not found` | setupOpen: false | Admin sudah ada, setup mode ditutup |
| `Invalid CSRF token` | Token tidak sesuai atau expired | Hapus cookie dan login ulang |

---

## 8. Debugging Tips

### 8.1 Enable Debug Logging

Edit `wrangler.toml`:
```toml
[vars]
LOG_LEVEL = "debug"
```

Deploy ulang dan cek console logs di Cloudflare Dashboard.

### 8.2 View Worker Logs

```bash
# Stream logs real-time
wrangler tail --format pretty

# Atau lihat di Cloudflare Dashboard:
# Workers & Pages > Your Worker > Real-time logs
```

### 8.3 Check Request/Response via Browser DevTools

1. Buka: `https://sahabatodhiv-sumut.aryprayoga139.workers.dev`
2. Tekan F12 (Developer Tools)
3. Tab "Network"
4. Masukkan credentials dan tekan login
5. Cek request `/api/login`:
   - Status harus 200 OK
   - Response JSON harus punya `csrfToken` dan `admin` object

### 8.4 Query Database Secara Manual

```bash
# Cek semua session yang aktif
wrangler d1 execute ppks-odhiv-auth --remote --command "SELECT id_hash, admin_id, created_at, expires_at FROM sessions WHERE revoked_at IS NULL;"

# Cek login attempts (throttling)
wrangler d1 execute ppks-odhiv-auth --remote --command "SELECT username_key, attempted_at, succeeded FROM login_attempts ORDER BY attempted_at DESC LIMIT 10;"

# Cek audit log
wrangler d1 execute ppks-odhiv-auth --remote --command "SELECT admin_id, action, created_at FROM audit_log ORDER BY created_at DESC LIMIT 10;"
```

---

## 9. Next Steps

Setelah login berhasil:

1. **Setup Google Sheets Integration**
   - Set `GOOGLE_SHEET_ID` di secrets
   - Set `GOOGLE_SHEET_TAB` di wrangler.toml
   - Grant service account access ke spreadsheet

2. **Test Respondent Data Loading**
   - Klik "Muat data responden" di dashboard
   - Verifikasi data dari Google Sheets muncul

3. **Setup Rate Limiting & Security**
   - Update login throttling rules
   - Configure CSRF & CORS properly
   - Enable audit logging untuk semua aksi admin

4. **Production Deployment**
   - Review security checklist di README.md
   - Setup monitoring & alerting
   - Configure backup & disaster recovery

---

## Rollback Jika Perlu

Jika ada error severe:

```bash
# Revert ke versi sebelumnya
git checkout HEAD~1

# Build & deploy versi lama
npm run build
npm run deploy
```

Atau lihat deployment history di Cloudflare Dashboard untuk rollback otomatis.

