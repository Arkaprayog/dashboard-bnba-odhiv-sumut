#!/usr/bin/env bash
# Secure one-time owner bootstrap for Sahabat ODHIV Sumut.
# Never pass the password or bootstrap token as command-line arguments.
set -Eeuo pipefail
umask 077

DEFAULT_DOMAIN="sahabatodhivsumut.web.id"
API_USER="${1:-}"
DISPLAY_NAME="${2:-}"
DOMAIN="${3:-$DEFAULT_DOMAIN}"

usage() {
  cat <<'EOF'
Penggunaan:
  ./scripts/setup-admin.sh <username> "<nama tampilan>" [domain]

Password dan OWNER_BOOTSTRAP_TOKEN diminta secara tersembunyi,
tidak diberikan sebagai argumen command line.

Contoh:
  ./scripts/setup-admin.sh operator "Admin PPKS"
EOF
}

if [[ -z "$API_USER" || -z "$DISPLAY_NAME" ]]; then
  usage
  exit 2
fi

API_USER="$(printf '%s' "$API_USER" | tr '[:upper:]' '[:lower:]')"
if [[ ! "$API_USER" =~ ^[a-z0-9._-]{3,64}$ ]]; then
  echo "Username harus 3-64 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung." >&2
  exit 2
fi
if [[ "${#DISPLAY_NAME}" -lt 2 || "${#DISPLAY_NAME}" -gt 100 ]]; then
  echo "Nama tampilan harus terdiri dari 2-100 karakter." >&2
  exit 2
fi
if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Domain tidak valid. Masukkan hostname saja, tanpa https:// atau path." >&2
  exit 2
fi

for cmd in curl jq python3 mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Perintah yang dibutuhkan tidak ditemukan: $cmd" >&2; exit 2; }
done

ORIGIN="https://$DOMAIN"
API_URL="$ORIGIN/api"
PASSWORD=""
PASSWORD_CONFIRM=""
BOOTSTRAP_TOKEN="${OWNER_BOOTSTRAP_TOKEN:-}"
PAYLOAD_FILE="$(mktemp)"
RESPONSE_FILE="$(mktemp)"
AUTH_CONFIG="$(mktemp)"
cleanup() {
  rm -f "$PAYLOAD_FILE" "$RESPONSE_FILE" "$AUTH_CONFIG"
  unset PASSWORD PASSWORD_CONFIRM BOOTSTRAP_TOKEN OWNER_BOOTSTRAP_TOKEN 2>/dev/null || true
}
trap cleanup EXIT

read -r -s -p "Password owner (minimal 14 karakter): " PASSWORD
printf '\n'
read -r -s -p "Ulangi password owner: " PASSWORD_CONFIRM
printf '\n'
if [[ "$PASSWORD" != "$PASSWORD_CONFIRM" ]]; then
  echo "Password tidak sama." >&2
  exit 2
fi
if [[ "${#PASSWORD}" -lt 14 || "${#PASSWORD}" -gt 1024 || ! "$PASSWORD" =~ [0-9] || ! "$PASSWORD" =~ [^A-Za-z0-9] ]]; then
  echo "Gunakan password 14-1024 karakter yang mengandung angka dan simbol." >&2
  exit 2
fi

if [[ -z "$BOOTSTRAP_TOKEN" ]]; then
  read -r -s -p "Token OWNER_BOOTSTRAP_TOKEN (input tersembunyi): " BOOTSTRAP_TOKEN
  printf '\n'
fi
if [[ "${#BOOTSTRAP_TOKEN}" -lt 32 || ! "$BOOTSTRAP_TOKEN" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Token bootstrap harus minimal 32 karakter dan hanya memakai huruf, angka, _ atau -." >&2
  exit 2
fi

# Serialize through stdin; never pass the password in a child process argument.
printf '%s\0%s\0%s' "$API_USER" "$DISPLAY_NAME" "$PASSWORD" |
  python3 -c 'import json,sys; u,n,p=sys.stdin.buffer.read().split(b"\0"); print(json.dumps({"username":u.decode(),"displayName":n.decode(),"password":p.decode()}))' > "$PAYLOAD_FILE"

# Keep the bootstrap token out of curl command-line arguments and logs.
printf 'header = "X-Owner-Bootstrap-Token: %s"\n' "$BOOTSTRAP_TOKEN" > "$AUTH_CONFIG"
chmod 600 "$PAYLOAD_FILE" "$AUTH_CONFIG"

echo "Memeriksa status setup pada $ORIGIN ..."
if ! curl --connect-timeout 8 --max-time 20 --fail --silent --show-error \
    -H "Accept: application/json" "$API_URL/setup-status" -o "$RESPONSE_FILE"; then
  echo "Tidak dapat memverifikasi status setup. Tidak ada perubahan yang dibuat." >&2
  exit 1
fi
if ! jq -e '.ok == true and .setupOpen == true' "$RESPONSE_FILE" >/dev/null 2>&1; then
  echo "Setup owner tidak terbuka atau status tidak dapat diverifikasi. Tidak ada data yang dihapus." >&2
  exit 1
fi

echo "Mengirim permintaan pembuatan owner melalui HTTPS ..."
HTTP_CODE="$(curl --config "$AUTH_CONFIG" --connect-timeout 8 --max-time 25 \
  --silent --show-error --output "$RESPONSE_FILE" --write-out '%{http_code}' \
  -X POST -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  --data-binary "@$PAYLOAD_FILE" "$API_URL/setup-owner" || true)"

if [[ "$HTTP_CODE" != "201" ]] || ! jq -e '.ok == true' "$RESPONSE_FILE" >/dev/null 2>&1; then
  ERROR_MESSAGE="$(jq -r '.error // .message // "Permintaan gagal. Periksa status Worker dan secret bootstrap."' "$RESPONSE_FILE" 2>/dev/null || true)"
  echo "Pembuatan owner gagal (HTTP ${HTTP_CODE:-tidak diketahui}): $ERROR_MESSAGE" >&2
  exit 1
fi

echo "Akun owner berhasil dibuat."
echo "PENTING: hapus secret OWNER_BOOTSTRAP_TOKEN dari Cloudflare Worker sekarang."
echo "Setelah secret dihapus, endpoint bootstrap tidak lagi dapat dipakai; jangan menghapus baris admin langsung dari database."
