#!/bin/bash

# Script untuk setup admin account otomatis
# Usage: ./scripts/setup-admin.sh [username] [display_name] [password] [domain]

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DOMAIN="${4:-dashboard-bnba-odhiv-sumut.aryprayoga139.workers.dev}"
API_URL="https://${DOMAIN}/api"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Admin Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Validate inputs
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  echo -e "${YELLOW}Usage: $0 <username> <display_name> <password> [domain]${NC}"
  echo ""
  echo "Example:"
  echo "  $0 admin 'Admin PPKS' 'SecurePassword123456!'"
  echo "  $0 admin 'Admin PPKS' 'SecurePassword123456!' 'dashboard-bnba-odhiv-sumut.aryprayoga139.workers.dev'"
  echo ""
  echo "Password requirements:"
  echo "  - Minimum 6 characters"
  echo "  - Must contain at least one number"
  echo "  - Must contain at least one special character"
  echo ""
  exit 1
fi

USERNAME="$1"
DISPLAY_NAME="$2"
PASSWORD="$3"

echo -e "${BLUE}Configuration:${NC}"
echo "  Domain:       ${DOMAIN}"
echo "  API URL:      ${API_URL}"
echo "  Username:     ${USERNAME}"
echo "  Display Name: ${DISPLAY_NAME}"
echo ""

# Step 1: Check setup status
echo -e "${BLUE}Step 1: Checking setup status...${NC}"

SETUP_STATUS=$(curl -s "${API_URL}/setup-status")
echo "Response: $SETUP_STATUS" | jq '.' 2>/dev/null || echo "Response: $SETUP_STATUS"

SETUP_OPEN=$(echo "$SETUP_STATUS" | jq -r '.setupOpen // false' 2>/dev/null)
if [ "$SETUP_OPEN" != "true" ]; then
  echo -e "${RED}✗ Setup mode is closed. Admin account already exists.${NC}"
  echo ""
  echo "If you need to reset admin, delete from database and retry:"
  echo "  wrangler d1 execute ppks-odhiv-auth --remote --command \"DELETE FROM admins;\""
  echo ""
  exit 1
fi

echo -e "${GREEN}✓ Setup mode is open${NC}"
echo ""

# Step 2: Validate password
echo -e "${BLUE}Step 2: Validating password...${NC}"

PASSWORD_LENGTH=${#PASSWORD}
if [ "$PASSWORD_LENGTH" -lt 6 ]; then
  echo -e "${RED}✗ Password must be at least 6 characters (current: $PASSWORD_LENGTH)${NC}"
  exit 1
fi

if [ "$PASSWORD_LENGTH" -gt 1024 ]; then
  echo -e "${RED}✗ Password must not exceed 1024 characters${NC}"
  exit 1
fi

if ! echo "$PASSWORD" | grep -q '[0-9]'; then
  echo -e "${RED}✗ Password must contain at least one number${NC}"
  exit 1
fi

if ! echo "$PASSWORD" | grep -q '[^A-Za-z0-9]'; then
  echo -e "${RED}✗ Password must contain at least one special character${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Password validation passed${NC}"
echo ""

# Step 3: Create owner account
echo -e "${BLUE}Step 3: Creating owner account...${NC}"

SETUP_RESPONSE=$(curl -s -X POST "${API_URL}/setup-owner" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"display_name\": \"${DISPLAY_NAME}\",
    \"password\": \"${PASSWORD}\"
  }")

echo "Response:"
echo "$SETUP_RESPONSE" | jq '.' 2>/dev/null || echo "$SETUP_RESPONSE"
echo ""

OK=$(echo "$SETUP_RESPONSE" | jq -r '.ok // false' 2>/dev/null)
if [ "$OK" != "true" ]; then
  ERROR=$(echo "$SETUP_RESPONSE" | jq -r '.error // "Unknown error"' 2>/dev/null)
  echo -e "${RED}✗ Setup failed: $ERROR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Owner account created successfully${NC}"
echo ""

# Step 4: Verify admin was created
echo -e "${BLUE}Step 4: Verifying admin account...${NC}"

# For this step, user needs to have wrangler access
if ! command -v wrangler &> /dev/null; then
  echo -e "${YELLOW}⚠ wrangler CLI not found, skipping database verification${NC}"
  echo ""
  echo -e "${GREEN}Setup completed! You can now login with:${NC}"
  echo "  Username: ${USERNAME}"
  echo "  Password: (as provided)"
  echo ""
  exit 0
fi

ADMIN_CHECK=$(wrangler d1 execute ppks-odhiv-auth --remote --command "SELECT id, username, display_name, role, active FROM admins WHERE username='${USERNAME}' LIMIT 1;" 2>/dev/null || echo "{}")

if [ -z "$ADMIN_CHECK" ] || [ "$ADMIN_CHECK" = "{}" ]; then
  echo -e "${YELLOW}⚠ Could not verify admin in database (might need time to replicate)${NC}"
else
  echo "Admin record:"
  echo "$ADMIN_CHECK" | jq '.' 2>/dev/null || echo "$ADMIN_CHECK"
  echo -e "${GREEN}✓ Admin verified in database${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Go to: https://${DOMAIN}"
echo "2. Login with:"
echo "   Username: ${USERNAME}"
echo "   Password: (as provided)"
echo "3. Check the browser console (F12) if you encounter any issues"
echo ""
