interface AdminRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  role: "owner" | "admin" | "staff";
  active: number;
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_ORIGIN: string;
  SESSION_TTL_SECONDS?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SHEET_TAB?: string;
}

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

function reply(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...NO_STORE, "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "");
}

function isAllowedOrigin(request: Request, env: Env): boolean {
  const originHeader = request.headers.get("Origin");
  if (!originHeader) return true;

  const requestOrigin = normalizeOrigin(originHeader);
  const fallbackOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set<string>([
    env.APP_ORIGIN ? normalizeOrigin(env.APP_ORIGIN) : "",
    fallbackOrigin,
  ].filter((value): value is string => Boolean(value)));

  return allowedOrigins.has(requestOrigin);
}

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

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("Cookie") || "";
  for (const item of raw.split(";")) {
    const i = item.indexOf("=");
    if (i > 0 && item.slice(0, i).trim() === name) return item.slice(i + 1).trim();
  }
  return null;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unhex(s: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(s)) return new Uint8Array();
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function digestHex(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = Uint8Array.from(salt).buffer as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBuffer, iterations: 100000, hash: "SHA-256" }, key, 256));
}

async function sessionAdmin(request: Request, env: Env) {
  const raw = cookieValue(request, "ppks_session");
  if (!raw || raw.length > 200) return null;
  const hash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(`SELECT a.id,a.username,a.display_name,a.role,s.csrf_token
    FROM sessions s JOIN admins a ON a.id=s.admin_id
    WHERE s.id_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.active=1`).bind(hash, now).first<Record<string, string>>();
}

async function googleAccessToken(env: Env): Promise<string> {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const pem = env.GOOGLE_PRIVATE_KEY;
  if (!email || !pem) throw new Error("Google API belum dikonfigurasi.");

  const now = Math.floor(Date.now() / 1000);
  const enc = (v: unknown) => b64(new TextEncoder().encode(JSON.stringify(v)));
  const header = enc({ alg: "RS256", typ: "JWT" });
  const claim = enc({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const unsigned = header + "." + claim;

  const normalizedPem = pem.replace(/\\n/g, "\n").trim();
  const body = normalizedPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s/g, "");
  const binary = atob(body);
  const keyBytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + b64(new Uint8Array(signature));

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });

  if (!response.ok) throw new Error("Google OAuth menolak kredensial (HTTP " + response.status + "). Periksa email service account dan format GOOGLE_PRIVATE_KEY.");
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Token Google tidak tersedia.");
  return data.access_token;
}

async function audit(env: Env, adminId: string, action: string) {
  await env.DB.prepare("INSERT INTO audit_log(admin_id,action) VALUES(?,?)").bind(adminId, action).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      try {
        if (!env.DB) return reply({ ok: false, service: "dashboard-bnba-odhiv-sumut", error: "Database D1 belum dikonfigurasi." }, 503);
        await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return reply({ ok: true, service: "dashboard-bnba-odhiv-sumut", database: "connected", mode: "ready" });
      } catch (error) {
        const incidentId = logIncident("health_check_failed", error, { path: url.pathname });
        return reply({ ok: false, service: "dashboard-bnba-odhiv-sumut", error: "Pemeriksaan backend gagal.", incidentId }, 503);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      let requestStage = "route_dispatch";
      try {
        if (!env.DB) return reply({ error: "Database D1 belum dikonfigurasi." }, 503);

        if (url.pathname === "/api/setup-status" && request.method === "GET") {
          try {
            const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins").first<{ n: number }>();
            return reply({ ok: true, setupOpen: !!count && count.n === 0 });
          } catch (error) {
            const incidentId = logIncident("setup_status_database_error", error, { path: url.pathname });
            return reply({ ok: false, error: "Status setup tidak dapat diperiksa. Periksa log Worker dengan ID insiden: " + incidentId }, 503);
          }
        }

        if (url.pathname === "/api/setup-owner" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);

          const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins").first<{ n: number }>();
          if (!count || count.n !== 0) return reply({ error: "Setup awal sudah ditutup karena akun admin sudah ada." }, 409);

          let body: { username?: string; displayName?: string; password?: string };
          try {
            body = await request.json() as typeof body;
          } catch {
            return reply({ error: "Format permintaan tidak valid." }, 400);
          }

          const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
          const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";

          if (!/^[a-z0-9._-]{3,64}$/.test(username) || displayName.length < 2 || displayName.length > 100 || password.length < 6 || password.length > 1024 || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
            return reply({ error: "Data akun tidak valid. Gunakan username 3-64 karakter dan password minimal 6 karakter dengan angka serta simbol." }, 400);
          }

          const salt = crypto.getRandomValues(new Uint8Array(16));
          const hash = await passwordHash(password, salt);
          const hex = (v: Uint8Array) => [...v].map((n) => n.toString(16).padStart(2, "0")).join("");
          const id = crypto.randomUUID();

          await env.DB.prepare("INSERT INTO admins(id,username,display_name,password_hash,password_salt,role,active) VALUES(?,?,?,?,?,?,?)").bind(id, username, displayName, hex(hash), hex(salt), "owner", 1).run();
          await audit(env, id, "owner_bootstrap");

          return reply({ ok: true, message: "Akun owner berhasil dibuat. Simpan kredensial dengan aman dan segera masuk untuk memeriksa pengaturan." }, 201);
        }

        if (url.pathname === "/api/login" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);

          let body: { password?: string };
          try {
            body = await request.json() as typeof body;
          } catch {
            return reply({ error: "Format permintaan tidak valid." }, 400);
          }

          const password = typeof body.password === "string" ? body.password : "";
          if (password.length < 1 || password.length > 1024) {
            return reply({ error: "Password salah." }, 401);
          }

          // One shared rate limit prevents bypass by changing usernames.
          const loginKey = "password-only";
          requestStage = "login_rate_limit_check";
          const now = Math.floor(Date.now() / 1000);
          const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE username_key=? AND attempted_at>? AND succeeded=0").bind(loginKey, now - 900).first<{ n: number }>();
          if ((recent?.n || 0) >= 10) return reply({ error: "Terlalu banyak percobaan login. Coba lagi setelah 15 menit." }, 429, { "retry-after": "900" });

          requestStage = "login_record_attempt";
          const attempt = await env.DB.prepare("INSERT INTO login_attempts(username_key,attempted_at,succeeded) VALUES(?,?,0)").bind(loginKey, now).run();
          const attemptId = attempt.meta.last_row_id;

          requestStage = "login_lookup_admin";
          const admins = await env.DB.prepare("SELECT id,username,display_name,password_hash,password_salt,role,active FROM admins WHERE active=1 ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, id LIMIT 50").all<AdminRow>();
          const matches: AdminRow[] = [];
          requestStage = "login_verify_password";
          for (const candidate of admins.results || []) {
            const salt = unhex(candidate.password_salt);
            const expected = unhex(candidate.password_hash);
            if (salt.length < 16 || expected.length === 0) continue;
            const actual = await passwordHash(password, salt);
            let diff = actual.length ^ expected.length;
            for (let i = 0; i < Math.max(actual.length, expected.length); i++) diff |= (actual[i] || 0) ^ (expected[i] || 0);
            if (diff === 0) matches.push(candidate);
          }
          if (matches.length !== 1) return reply({ error: "Password salah atau tidak unik. Hubungi pengelola untuk mengatur password yang berbeda." }, 401);
          const admin = matches[0];

          requestStage = "login_create_session";
          await env.DB.prepare("UPDATE login_attempts SET succeeded=1 WHERE id=?").bind(attemptId).run();
          const raw = b64(crypto.getRandomValues(new Uint8Array(32)));
          const csrf = b64(crypto.getRandomValues(new Uint8Array(24)));
          const idHash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
          const sessionNow = Math.floor(Date.now() / 1000);
          const ttl = Math.max(900, Math.min(28800, Number(env.SESSION_TTL_SECONDS) || 28800));
          await env.DB.prepare("INSERT INTO sessions(id_hash,admin_id,csrf_token,created_at,expires_at) VALUES(?,?,?,?,?)").bind(idHash, admin.id, csrf, sessionNow, sessionNow + ttl).run();

          requestStage = "login_update_admin";
          await env.DB.prepare("UPDATE admins SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").bind(admin.id).run();

          requestStage = "login_audit";
          await audit(env, admin.id, "login_success");

          return reply({ ok: true, admin: { username: admin.username, display_name: admin.display_name, role: admin.role }, csrfToken: csrf }, 200, {
            "set-cookie": `ppks_session=${raw}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`,
          });
        }

        if (url.pathname === "/api/change-password" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);

          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Sesi login tidak berlaku. Silakan login kembali." }, 401);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);

          let body: { currentPassword?: string; newPassword?: string };
          try {
            body = await request.json() as typeof body;
          } catch {
            return reply({ error: "Format permintaan tidak valid." }, 400);
          }

          const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
          const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
          if (!currentPassword || newPassword.length < 12 || newPassword.length > 1024 ||
              !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) ||
              !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
            return reply({ error: "Password baru minimal 12 karakter dan harus memuat huruf besar, huruf kecil, angka, serta simbol." }, 400);
          }
          if (currentPassword === newPassword) return reply({ error: "Password baru harus berbeda dari password saat ini." }, 400);

          const stored = await env.DB.prepare("SELECT password_hash,password_salt FROM admins WHERE id=? AND active=1")
            .bind(admin.id).first<{ password_hash: string; password_salt: string }>();
          if (!stored) return reply({ error: "Akun admin tidak aktif atau tidak ditemukan." }, 401);

          const currentSalt = unhex(stored.password_salt);
          const expected = unhex(stored.password_hash);
          if (currentSalt.length < 16 || expected.length !== 32) {
            throw new Error("Stored password hash format is invalid.");
          }
          const actual = await passwordHash(currentPassword, currentSalt);
          let diff = actual.length ^ expected.length;
          for (let i = 0; i < Math.max(actual.length, expected.length); i++) diff |= (actual[i] || 0) ^ (expected[i] || 0);
          if (diff !== 0) return reply({ error: "Password saat ini tidak cocok." }, 401);

          const newSalt = crypto.getRandomValues(new Uint8Array(16));
          const newHash = await passwordHash(newPassword, newSalt);
          const hex = (v: Uint8Array) => [...v].map((n) => n.toString(16).padStart(2, "0")).join("");
          await env.DB.prepare("UPDATE admins SET password_hash=?,password_salt=? WHERE id=? AND active=1")
            .bind(hex(newHash), hex(newSalt), admin.id).run();
          await audit(env, admin.id, "password_change");
          await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE admin_id=? AND revoked_at IS NULL")
            .bind(Math.floor(Date.now() / 1000), admin.id).run();

          return reply({ ok: true, message: "Password berhasil diganti. Silakan login kembali dengan password baru." }, 200, {
            "set-cookie": "ppks_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
          });
        }

        if (url.pathname === "/api/respondents" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengakses data responden." }, 403);
          if (!env.GOOGLE_SHEET_ID) return reply({ error: "Integrasi Google Sheets belum dikonfigurasi." }, 503);

          try {
            const token = await googleAccessToken(env);
            const tab = (env.GOOGLE_SHEET_TAB || "From Response 1").replace(/'/g, "''");
            const range = "'" + tab + "'!A1:AZ1000";
            const sheetUrl = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID) + "/values/" + encodeURIComponent(range) + "?valueRenderOption=FORMATTED_VALUE";
            const response = await fetch(sheetUrl, { headers: { authorization: "Bearer " + token } });
            if (!response.ok) {
              let detail = "";
              try { const payload = await response.json() as { error?: { status?: string; message?: string } }; detail = [payload.error?.status, payload.error?.message].filter(Boolean).join(": "); } catch { /* Abaikan respons error yang bukan JSON. */ }
              return reply({ error: "Google Sheets menolak permintaan (HTTP " + response.status + "). " + (detail || "Periksa izin spreadsheet, ID spreadsheet, dan nama tab.") }, 502);
            }
            const sheet = await response.json() as { values?: string[][] };
            const values = sheet.values || [];
            if (values.length < 1) return reply({ items: [], headers: [] });
            const headers = values[0].map((v) => String(v || "").trim());
            const items = values.slice(1).filter((row) => row.some((v) => String(v || "").trim())).map((row, index) => {
              const record: Record<string, string> = {};
              headers.forEach((header, i) => {
                if (header) record[header] = String(row[i] || "");
              });
              record["_row"] = String(index + 2);
              return record;
            });
            return reply({ headers, items, source: "Google Sheets", count: items.length });
          } catch (error) {
            const incidentId = logIncident("respondents_error", error, { path: url.pathname, stage: requestStage });
            const safeMessage = error instanceof Error ? error.message : "Kesalahan integrasi tidak diketahui.";
            return reply({ error: "Integrasi Google Sheets gagal: " + safeMessage + " (ID insiden: " + incidentId + ")" }, 503);
          }
        }

        if (url.pathname === "/api/workflow" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          const rows = await env.DB.prepare("SELECT respondent_key,report_status,desil,template_choice,updated_at FROM respondent_workflow ORDER BY updated_at DESC LIMIT 500").all();
          return reply({ items: rows.results || [], csrfToken: admin.csrf_token, note: "Metadata workflow saja; belum terhubung ke Google Sheets." });
        }

        if (url.pathname === "/api/workflow" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);

          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengubah metadata." }, 403);

          let body: { respondentKey?: string; reportStatus?: string; desil?: number | null; templateChoice?: string | null };
          try {
            body = await request.json() as typeof body;
          } catch {
            return reply({ error: "Format permintaan tidak valid." }, 400);
          }

          const key = typeof body.respondentKey === "string" ? body.respondentKey.trim() : "";
          const statuses = ["Sudah Dilaporkan", "Belum Dilaporkan", "Proses Verifikasi"];
          const templates = ["Template 1", "Template 2"];
          if (!/^[A-Za-z0-9_-]{12,100}$/.test(key) || typeof body.reportStatus !== "string" || !statuses.includes(body.reportStatus)) return reply({ error: "Kunci responden atau status tidak valid." }, 400);
          if (body.desil !== undefined && body.desil !== null && (!Number.isInteger(body.desil) || body.desil < 0 || body.desil > 10)) return reply({ error: "Desil harus angka 0 sampai 10." }, 400);
          if (body.templateChoice !== undefined && body.templateChoice !== null && !templates.includes(body.templateChoice)) return reply({ error: "Pilihan template tidak valid." }, 400);

          const desil = body.desil === undefined ? null : body.desil;
          const template = body.templateChoice === undefined ? null : body.templateChoice;
          await env.DB.prepare("INSERT INTO respondent_workflow(respondent_key,report_status,desil,template_choice,updated_by,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(respondent_key) DO UPDATE SET report_status=excluded.report_status, desil=excluded.desil, template_choice=excluded.template_choice, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP").bind(key, body.reportStatus, desil, template, admin.id).run();
          await audit(env, admin.id, "workflow_update");
          return reply({ ok: true });
        }

        if (url.pathname === "/api/me" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          return reply({ admin: { username: admin.username, display_name: admin.display_name, role: admin.role }, csrfToken: admin.csrf_token });
        }

        if (url.pathname === "/api/logout" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);

          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ ok: true }, 200, { "set-cookie": "ppks_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);

          const raw = cookieValue(request, "ppks_session");
          if (!raw) return reply({ ok: true }, 200, { "set-cookie": "ppks_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
          const hash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
          await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE id_hash=?").bind(Math.floor(Date.now() / 1000), hash).run();
          await audit(env, admin.id, "logout");
          return reply({ ok: true }, 200, { "set-cookie": "ppks_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
        }

        return reply({ error: "Endpoint data belum diaktifkan. Login tidak membuka akses data sampai integrasi selesai." }, 503);
      } catch (error) {
        const incidentId = logIncident("api_unhandled_error", error, { path: url.pathname, method: request.method, stage: requestStage });
        return reply({ error: "Terjadi kesalahan internal pada server. Periksa log Worker dengan ID insiden: " + incidentId, incidentId, stage: requestStage }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
