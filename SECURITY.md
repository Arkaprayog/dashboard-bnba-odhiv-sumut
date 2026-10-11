# Security Documentation - BNBA ODHIV SUMUT Dashboard

## Overview

This document outlines the security measures implemented in the BNBA ODHIV SUMUT Dashboard application running on Cloudflare Workers.

## Authentication & Authorization

### Password Security
- **Hashing Algorithm**: PBKDF2 with SHA-256
- **Salt Size**: 32 bytes (256 bits)
- **Iterations**: 310,000 (OWASP recommendation for 2024)
- **Hash Output Size**: 64 bytes (512 bits)

Implementation:
```typescript
async function passwordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, hash: "SHA-256", iterations: 310000 },
      await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]),
      512
    )
  );
}
```

### Session Management
- **Session Token**: 32 bytes of cryptographically secure random data (base64url encoded)
- **Session Hash**: SHA-256 digest of session token (stored in database)
- **CSRF Token**: 24 bytes of cryptographically secure random data
- **TTL Configuration**: Default 8 hours, minimum 15 minutes, maximum 8 hours
- **Cookie Flags**: `HttpOnly`, `Secure`, `SameSite=Strict`
- **Session Cleanup**: Expired and revoked sessions auto-deleted daily

### Role-Based Access Control
Three user roles with escalating permissions:
1. **owner**: Full system access, can manage all admins
2. **admin**: Can modify respondent data, cannot manage admins
3. **staff**: Read-only access to respondent data

### Bootstrap Endpoint Security
- Only accessible if no admin accounts exist (one-time setup)
- Creates the first owner account
- Validates username format: `^[a-z0-9._-]{3,64}$`
- Validates password length: 1-1024 characters
- Returns generic error if admin exists (doesn't leak system state)

## API Security

### Input Validation
All API inputs are strictly validated:

**Login Endpoint** (`/api/login`)
- Username: Must match `^[a-z0-9._-]{3,64}$`, converted to lowercase
- Password: 1-1024 characters, no format restrictions
- Rate limited: Maximum 5 failed attempts per 15 minutes per username

**Change Password** (`/api/change-password`)
- Current password: 1-1024 characters
- New password: 1-1024 characters
- Both required and validated before database update

**Respondent Field** (`/api/respondent-field`)
- Row: Valid integer
- Field: Validated against allowed column names
- Value: Type-validated based on field definition

### Cross-Site Request Forgery (CSRF) Protection
- **Token Generation**: 24 bytes of cryptographically secure random data
- **Validation**: Strict comparison against X-CSRF-Token header
- **Scope**: All state-changing operations (POST, PUT, DELETE)
- **Token Binding**: Linked to specific session ID

### Rate Limiting
**Login Attempts:**
- Tracks failed attempts per username in 15-minute window
- Blocks accounts after 5 failed attempts
- Each failed attempt logged with timestamp
- Timeout: 15 minutes per failed attempt cycle

**Implementation:**
```typescript
const recent = await env.DB.prepare(
  "SELECT COUNT(*) AS n FROM login_attempts " +
  "WHERE username_key=? AND attempted_at>? AND succeeded=0"
).bind(loginKey, now - 900).first<{ n: number }>();

if (recent!.n >= 5) {
  return reply({ error: "Terlalu banyak percobaan login gagal. Coba lagi nanti." }, 429);
}
```

## HTTP Security Headers

All API responses include:
```
cache-control: no-store
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: no-referrer
permissions-policy: camera=(), microphone=(), geolocation=()
```

These headers prevent:
- **Cache poisoning**: Sensitive data cached by browsers/proxies
- **MIME-sniffing attacks**: Browser detecting file types incorrectly
- **Clickjacking**: Embedding in iframes
- **Referrer leaks**: Exposing URLs to external sites
- **Camera/Microphone access**: Preventing unauthorized device access

## Cross-Origin Resource Sharing (CORS)

### CORS Validation
```typescript
function isAllowedOrigin(request: Request, env: Env): boolean {
  const originHeader = request.headers.get("Origin");
  if (!originHeader) return false;

  const requestOrigin = normalizeOrigin(originHeader);
  const fallbackOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set<string>([
    env.APP_ORIGIN ? normalizeOrigin(env.APP_ORIGIN) : "",
    fallbackOrigin,
  ].filter((value): value is string => Boolean(value)));

  return allowedOrigins.has(requestOrigin);
}
```

**Rules:**
- Only `APP_ORIGIN` environment variable and fallback origin are allowed
- Exact origin matching (no wildcard)
- Trailing slashes normalized for consistency
- Missing Origin header returns 403

## Database Security

### Query Protection
- All queries use prepared statements with parameter binding
- No string concatenation in SQL queries
- Parameter types validated before binding

**Example:**
```typescript
const admin = await env.DB.prepare(
  "SELECT id,username,display_name,password_hash,password_salt,role,active " +
  "FROM admins WHERE username=? AND active=1"
).bind(username).first<AdminRow>();
```

### Data Access
- Sensitive fields (`password_hash`, `password_salt`) never exposed in API responses
- Session data minimized in responses
- Admin information limited to username, display name, and role

### Audit Logging
All critical operations logged:
- `owner_bootstrap`: Initial admin account creation
- `login_success`: Successful login
- `login_failed`: Failed login attempt
- `logout`: User logout
- `password_changed`: Password change
- `respondent_field_updated`: Data modification

**Audit Log Entry:**
```typescript
async function audit(env: Env, adminId: string, action: string) {
  await env.DB.prepare(
    "INSERT INTO audit_log(admin_id,action,happened_at) VALUES(?,?,CURRENT_TIMESTAMP)"
  ).bind(adminId, action).run();
}
```

## Error Handling

### User-Friendly Messages
Generic error messages prevent information disclosure:
- ✗ "Username atau password salah" (bad credentials)
- ✗ "Origin tidak diizinkan" (CORS violation)
- ✗ "Sesi login tidak berlaku" (session expired)
- ✗ "Token CSRF tidak valid" (CSRF failure)

### Error Logging
Internal errors logged with incident IDs for server-side debugging:
```typescript
function logIncident(scope: string, error: unknown, context: Record<string, unknown> = {}) {
  const incidentId = crypto.randomUUID();
  console.error(scope, {
    incidentId,
    ...context,
    message: error instanceof Error ? error.message : "unknown_error",
    stack: error instanceof Error ? error.stack : undefined,
  });
  return incidentId;
}
```

## Session Security

### Session Storage
- Session token hash stored in database (SHA-256)
- Plain token only stored in HTTP-only cookie
- Session metadata: admin_id, csrf_token, created_at, expires_at

### Session Lifecycle
1. **Creation**: On successful login
2. **Validation**: On each API request (sessionAdmin function)
3. **Refresh**: Not implemented (stateless session)
4. **Revocation**: On logout or manual revocation
5. **Cleanup**: Automatic deletion of expired sessions

### Double-Submit Cookie Protection
Not implemented as CSRF tokens are used instead, which is more secure.

## Cryptography

### Random Number Generation
Uses Web Crypto API `crypto.getRandomValues()`:
- Session tokens: 32 bytes
- CSRF tokens: 24 bytes
- Cryptographically secure (suitable for cryptographic operations)

### Hashing Functions
- **SHA-256**: For password hashing (via PBKDF2)
- **SHA-256**: For session token hash
- **PBKDF2-SHA256**: For password derivation

## Infrastructure Security

### Cloudflare Workers Benefits
- DDoS protection: Cloudflare's global network
- SSL/TLS: Free automatic HTTPS
- Rate limiting: Available via Cloudflare dashboard
- Web Application Firewall (WAF): Available via Cloudflare dashboard
- Edge security: Protection at origin

### D1 Database
- Encrypted at rest
- Automatic backups
- Access control via Cloudflare API tokens
- Audit logs for administrative access

## Google Sheets Integration

### Service Account Authentication
- Uses service account email and private key
- Private key stored as environment variable (base64 encoded)
- NEVER exposed in API responses or client-side code
- Validated before each request

### Data Handling
- Respondent data is read/write from Google Sheets
- No sensitive authentication data stored in Sheets
- Rate limited by Google's API quotas

## Security Testing

### Test Cases
- [ ] Invalid username/password combinations
- [ ] SQL injection attempts
- [ ] CSRF attacks (missing/invalid tokens)
- [ ] Session hijacking (token prediction)
- [ ] Rate limiting evasion
- [ ] CORS origin spoofing
- [ ] Password hash collision attacks

### Vulnerability Scanning
- Use OWASP ZAP or similar tool
- Scan for common vulnerabilities
- Test all input fields
- Verify security headers

## Incident Response

### If Password Hash is Compromised
1. All admin passwords must be reset immediately
2. All active sessions must be revoked
3. Force re-authentication for all users
4. Audit logs should show password reset timestamps

### If Session Token is Exposed
1. Revoke the specific session immediately
2. Monitor account for suspicious activity
3. Consider forcing re-authentication
4. Review audit logs for unauthorized access

### If CSRF Token Validation Fails
1. Log the incident with details
2. Reject the request (403 Forbidden)
3. Notify user to retry
4. Review browser console for CORS errors

## Compliance & Standards

- **OWASP Top 10**: Addressed in design
- **NIST Cybersecurity Framework**: Following best practices
- **CWE/SANS Top 25**: Mitigated known weaknesses
- **GDPR**: Data minimization and user consent

## Update & Maintenance

### Regular Tasks
- [ ] Update Cloudflare Workers SDK monthly
- [ ] Review audit logs weekly
- [ ] Check for security advisories
- [ ] Test rate limiting monthly
- [ ] Rotate service account keys quarterly

### Version Management
- Tag releases in Git
- Document security fixes in release notes
- Test upgrades in staging environment

## Contact & Reporting

For security vulnerabilities, please report directly to the maintainers rather than filing public issues.

**Reporting:** [Add contact method here]

## References

- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- NIST Password Guidelines: https://pages.nist.gov/800-63-3/sp800-63b.html
- Cloudflare Workers Security: https://developers.cloudflare.com/workers/platform/security/
