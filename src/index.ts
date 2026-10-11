interface AdminRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  role: "owner" | "admin" | "staff";
  active: number;
}

import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_ORIGIN: string;
  SESSION_TTL_SECONDS?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SHEET_TAB?: string;
  OWNER_BOOTSTRAP_TOKEN?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_SUBJECT?: string;
}

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer", "permissions-policy": "camera=(), microphone=(), geolocation=()" };

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
  if (!originHeader) return false;

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
  const claim = enc({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const unsigned = header + "." + claim;

  const normalizedPem = pem.replace(/\\n/g, "\n").trim();
  const body = normalizedPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
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

  if (!response.ok) {
    let oauthCode = "";
    let oauthDescription = "";
    try {
      const payload = await response.json() as { error?: string; error_description?: string };
      oauthCode = payload.error || "";
      oauthDescription = payload.error_description || "";
    } catch { /* Respons OAuth bukan JSON; jangan tampilkan isi mentahnya. */ }
    const detail = [oauthCode, oauthDescription].filter(Boolean).join(": ");
    throw new Error("Google OAuth menolak kredensial (HTTP " + response.status + ")" + (detail ? " — " + detail : "") + ". Periksa email service account, status kunci, dan format GOOGLE_PRIVATE_KEY.");
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number; token_type?: string };
  if (!data.access_token) throw new Error("Google OAuth berhasil merespons tetapi token akses tidak tersedia.");
  return data.access_token;
}

async function ensureFeatureSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS owner_profile (
      id INTEGER PRIMARY KEY CHECK (id=1),
      photo_data TEXT NOT NULL DEFAULT '',
      photo_mime TEXT NOT NULL DEFAULT '',
      employee_name TEXT NOT NULL DEFAULT '',
      nip TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      institution TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint_hash TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS dashboard_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS notification_state (
      state_key TEXT PRIMARY KEY,
      state_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
}

async function sendPushToAll(env: Env, title: string, body: string, tag: string) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) return;
  const rows = await env.DB.prepare("SELECT endpoint_hash,endpoint,p256dh,auth FROM push_subscriptions").all<{
    endpoint_hash: string; endpoint: string; p256dh: string; auth: string;
  }>();
  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  await Promise.all((rows.results || []).map(async (row) => {
    try {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const payload = await buildPushPayload({ data: JSON.stringify({ title, body, tag, url: "/" }), options: { ttl: 300 } }, subscription, vapid);
      const response = await fetch(row.endpoint, payload);
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint_hash=?").bind(row.endpoint_hash).run();
      } else if (!response.ok) {
        console.warn("push_delivery_failed", { status: response.status });
      }
    } catch (error) {
      console.warn("push_delivery_failed", { message: error instanceof Error ? error.message : "unknown_error" });
    }
  }));
}

async function recordNotification(env: Env, title: string, body: string, action: string) {
  await ensureFeatureSchema(env);
  await env.DB.prepare("INSERT INTO dashboard_notifications(title,body,action) VALUES(?,?,?)")
    .bind(title.slice(0, 120), body.slice(0, 240), action.slice(0, 80)).run();
  await sendPushToAll(env, title, body, action);
}

async function audit(env: Env, adminId: string, action: string) {
  await env.DB.prepare("INSERT INTO audit_log(admin_id,action) VALUES(?,?)").bind(adminId, action).run();
  const labels: Record<string, { title: string; body: string }> = {
    workflow_update: { title: "Perubahan data workflow", body: "Status workflow dashboard telah diperbarui." },
    password_change: { title: "Password owner/admin diubah", body: "Password akun dashboard baru saja diubah." },
    respondent_update: { title: "Data responden diperbarui", body: "Ada perubahan data pada dashboard. Masuk untuk memeriksanya." },
    owner_profile_update: { title: "Profil owner diperbarui", body: "Informasi profil owner dashboard telah disimpan." },
    respondent_field_update: { title: "Data responden diperbarui", body: "Desil atau Status Laporan telah diubah di dashboard." },
    login_success: { title: "Login dashboard berhasil", body: "Ada sesi login baru ke dashboard. Jika ini bukan Anda, segera ganti password." },
    owner_bootstrap: { title: "Penyiapan owner selesai", body: "Akun owner dashboard telah dibuat atau disiapkan." },
    remove_status_pesan_column: { title: "Struktur data dashboard diperbarui", body: "Ada perubahan konfigurasi data dashboard." },
  };
  const notification = labels[action];
  if (notification) {
    try { await recordNotification(env, notification.title, notification.body, action); }
    catch (error) { console.warn("notification_record_failed", { action, message: error instanceof Error ? error.message : "unknown_error" }); }
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
      try {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM auth_challenges WHERE expires_at<=? OR used_at IS NOT NULL").bind(now),
          env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at<?").bind(thirtyDaysAgo),
          env.DB.prepare("DELETE FROM sessions WHERE expires_at<=? OR (revoked_at IS NOT NULL AND revoked_at<=?)").bind(now, now - 30 * 24 * 60 * 60),
        ]);
      } catch (error) {
        logIncident("scheduled_auth_housekeeping_failed", error);
        throw error;
      }
      if (env.GOOGLE_SHEET_ID && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
        try {
          await ensureFeatureSchema(env);
          const token = await googleAccessToken(env);
          const tab = (env.GOOGLE_SHEET_TAB || "From Response 1").trim().replace(/'/g, "''");
          const range = encodeURIComponent("'" + tab + "'!A:A");
          const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID) + "/values/" + range + "?majorDimension=ROWS", { headers: { authorization: "Bearer " + token } });
          if (!response.ok) throw new Error("Google Sheets row-count poll returned HTTP " + response.status);
          const payload = await response.json() as { values?: unknown[][] };
          const rowCount = (payload.values || []).filter(row => row.some(cell => String(cell ?? "").trim() !== "")).length;
          const prior = await env.DB.prepare("SELECT state_value FROM notification_state WHERE state_key='response_row_count'").first<{ state_value: string }>();
          if (!prior) {
            await env.DB.prepare("INSERT INTO notification_state(state_key,state_value) VALUES('response_row_count',?)").bind(String(rowCount)).run();
          } else {
            const previousCount = Number(prior.state_value) || 0;
            if (rowCount > previousCount) {
              await recordNotification(env, "Ada respons Google Form baru", "Data respons baru masuk. Masuk ke dashboard untuk memeriksanya.", "new_form_response");
            }
            if (rowCount !== previousCount) {
              await env.DB.prepare("UPDATE notification_state SET state_value=?,updated_at=CURRENT_TIMESTAMP WHERE state_key='response_row_count'").bind(String(rowCount)).run();
            }
          }
        } catch (error) {
          logIncident("scheduled_response_poll_failed", error, { task: "form_response_notifications" });
        }
      }
    })());
  },

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

          // Fail closed: never allow owner bootstrap without the configured secret.
          const expectedToken = env.OWNER_BOOTSTRAP_TOKEN || "";
          const suppliedToken = request.headers.get("X-Owner-Bootstrap-Token") || "";
          if (!expectedToken || suppliedToken.length !== expectedToken.length) {
            return reply({ error: "Token bootstrap tidak valid atau setup tidak diaktifkan." }, 403);
          }
          let tokenDiff = 0;
          for (let i = 0; i < expectedToken.length; i++) {
            tokenDiff |= expectedToken.charCodeAt(i) ^ suppliedToken.charCodeAt(i);
          }
          if (tokenDiff !== 0) return reply({ error: "Token bootstrap tidak valid atau setup tidak diaktifkan." }, 403);

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
            return reply({ error: "Password tidak valid." }, 401);
          }

          // Password-only login: no username field is required.
          const loginKey = "password-only";
          requestStage = "login_rate_limit_check";
          const now = Math.floor(Date.now() / 1000);
          const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE username_key=? AND attempted_at>? AND succeeded=0").bind(loginKey, now - 900).first<{ n: number }>();
          if ((recent?.n || 0) >= 10) return reply({ error: "Terlalu banyak percobaan login. Coba lagi setelah 15 menit." }, 429, { "retry-after": "900" });

          requestStage = "login_record_attempt";
          const attempt = await env.DB.prepare("INSERT INTO login_attempts(username_key,attempted_at,succeeded) VALUES(?,?,0)").bind(loginKey, now).run();
          const attemptId = attempt.meta.last_row_id;

          requestStage = "login_lookup_admin";
          const adminCount = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins WHERE active=1").first<{ n: number }>();
          if (!adminCount || adminCount.n === 0) {
            return reply({ error: "Akun admin belum dibuat. Lakukan setup owner terlebih dahulu." }, 401);
          }

          requestStage = "login_verify_password";
          const admins = await env.DB.prepare("SELECT id,username,display_name,password_hash,password_salt,role,active FROM admins WHERE active=1 LIMIT 50").all<AdminRow>();
          let admin: AdminRow | null = null;
          let matches = 0;
          for (const candidate of (admins.results || [])) {
            const salt = unhex(candidate.password_salt);
            const expected = unhex(candidate.password_hash);
            if (salt.length < 16 || expected.length === 0) continue;
            const actual = await passwordHash(password, salt);
            let diff = actual.length ^ expected.length;
            for (let i = 0; i < Math.max(actual.length, expected.length); i++) diff |= (actual[i] || 0) ^ (expected[i] || 0);
            if (diff === 0) {
              admin = candidate;
              matches++;
            }
          }
          if (matches === 0 || !admin) {
            return reply({ error: "Password salah. Silakan periksa lalu coba lagi." }, 401);
          }
          if (matches > 1) {
            return reply({ error: "Password ini digunakan oleh lebih dari satu akun admin. Demi keamanan, minta administrator menyamakan konfigurasi akun." }, 409);
          }

          requestStage = "login_create_session";
          await env.DB.prepare("UPDATE login_attempts SET succeeded=1 WHERE id=?").bind(attemptId).run();
          const raw = b64(crypto.getRandomValues(new Uint8Array(32)));
          const csrf = b64(crypto.getRandomValues(new Uint8Array(24)));
          const idHash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
          const sessionNow = Math.floor(Date.now() / 1000);
          const ttl = Math.max(900, Math.min(28800, Number(env.SESSION_TTL_SECONDS) || 28800));

          requestStage = "login_session_cleanup";
          await env.DB.prepare("DELETE FROM sessions WHERE expires_at<=? OR (revoked_at IS NOT NULL AND revoked_at<=?)").bind(sessionNow, sessionNow - 30 * 24 * 60 * 60).run();

          requestStage = "login_insert_session";
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

        if (url.pathname === "/api/respondent-photo" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengakses foto responden." }, 403);
          const fileId = (url.searchParams.get("id") || "").trim();
          if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return reply({ error: "ID foto tidak valid." }, 400);
          try {
            const token = await googleAccessToken(env);
            const driveUrl = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId);
            // Check Drive metadata first: the media response may use a generic content type,
            // while the authoritative file MIME type is returned by files.get metadata.
            const metadataResponse = await fetch(driveUrl + "?fields=id,name,mimeType&supportsAllDrives=true", { headers: { authorization: "Bearer " + token } });
            if (!metadataResponse.ok) {
              let driveReason = "";
              try {
                const payload = await metadataResponse.json() as { error?: { status?: string; message?: string; errors?: Array<{ reason?: string }> } };
                driveReason = [payload.error?.status, payload.error?.errors?.[0]?.reason, payload.error?.message].filter(Boolean).join(" — ");
              } catch {}
              return reply({ error: "Google Drive gagal membaca metadata foto (HTTP " + metadataResponse.status + "). " + (driveReason || "Periksa izin file dan akses API Drive.") }, 502);
            }
            const metadata = await metadataResponse.json() as { name?: string; mimeType?: string };
            const type = (metadata.mimeType || "").toLowerCase();
            if (!type.startsWith("image/")) {
              return reply({ error: "File di Google Sheets bukan file gambar yang bisa ditampilkan. Jenis file: " + (type || "tidak diketahui") + (metadata.name ? "; nama file: " + metadata.name : "") + ". Pastikan sel berisi tautan file foto asli (JPEG, PNG, atau WebP), bukan folder, PDF, atau shortcut." }, 415);
            }
            const response = await fetch(driveUrl + "?alt=media&supportsAllDrives=true", { headers: { authorization: "Bearer " + token } });
            if (!response.ok) {
              let driveReason = "";
              try {
                const payload = await response.json() as { error?: { status?: string; message?: string; errors?: Array<{ reason?: string }> } };
                driveReason = [payload.error?.status, payload.error?.errors?.[0]?.reason, payload.error?.message].filter(Boolean).join(" — ");
              } catch {}
              return reply({ error: "Google Drive gagal mengirim foto (HTTP " + response.status + "). " + (driveReason || "Periksa izin file dan akses API Drive.") }, 502);
            }
            const responseType = (response.headers.get("content-type") || "").toLowerCase();
            const safeType = responseType.startsWith("image/") ? responseType : type;
            return new Response(response.body, { status: 200, headers: { ...NO_STORE, "content-type": safeType, "cache-control": "private, no-store", "content-disposition": "inline", "x-content-type-options": "nosniff" } });
          } catch (error) {
            const incidentId = logIncident("respondent_photo_error", error, { path: url.pathname, stage: requestStage });
            return reply({ error: "Foto responden gagal dimuat. ID insiden: " + incidentId }, 502);
          }
        }

        if (url.pathname === "/api/respondents" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengakses data responden." }, 403);
          if (!env.GOOGLE_SHEET_ID) return reply({ error: "Integrasi Google Sheets belum dikonfigurasi." }, 503);

          try {
            const token = await googleAccessToken(env);
            const spreadsheetBase = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID);
            const metadataResponse = await fetch(spreadsheetBase + "?fields=sheets.properties.title", { headers: { authorization: "Bearer " + token } });
            if (!metadataResponse.ok) {
              let detail = "";
              try { const payload = await metadataResponse.json() as { error?: { status?: string; message?: string } }; detail = [payload.error?.status, payload.error?.message].filter(Boolean).join(": "); } catch {}
              return reply({ error: "Tidak dapat membaca daftar tab Google Sheets (HTTP " + metadataResponse.status + "). " + (detail || "Periksa ID spreadsheet dan izin service account.") }, 502);
            }
            const metadata = await metadataResponse.json() as { sheets?: Array<{ properties?: { title?: string } }> };
            const sheetTitles = (metadata.sheets || []).map((sheet) => sheet.properties?.title || "").filter(Boolean);
            const configuredTab = (env.GOOGLE_SHEET_TAB || "From Response 1").trim();
            const normalizeTab = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
            let tab = sheetTitles.find((title) => title === configuredTab);
            if (!tab) {
              const normalizedConfigured = normalizeTab(configuredTab);
              tab = sheetTitles.find((title) => normalizeTab(title) === normalizedConfigured);
            }
            if (!tab) {
              const responseTabCandidates = sheetTitles.filter((title) => /^(formresponses?1|fromresponses?1)$/.test(normalizeTab(title)));
              if (responseTabCandidates.length === 1) tab = responseTabCandidates[0];
            }
            if (!tab) {
              return reply({ error: "Nama tab respons tidak cocok. Tab yang tersedia: " + (sheetTitles.join(", ") || "(tidak ada)") + ". Atur GOOGLE_SHEET_TAB sesuai nama tab yang benar." }, 502);
            }
            const range = "'" + tab.replace(/'/g, "''") + "'!A1:AZ1000";
            const encodedRange = encodeURIComponent(range).replace(/[\x27!()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
            const sheetUrl = spreadsheetBase + "/values/" + encodedRange + "?valueRenderOption=FORMATTED_VALUE";
            const response = await fetch(sheetUrl, { headers: { authorization: "Bearer " + token } });
            if (!response.ok) {
              let detail = "";
              try { const payload = await response.json() as { error?: { status?: string; message?: string } }; detail = [payload.error?.status, payload.error?.message].filter(Boolean).join(": "); } catch {}
              return reply({ error: "Google Sheets menolak permintaan (HTTP " + response.status + "). " + (detail || "Periksa izin spreadsheet, ID spreadsheet, dan nama tab.") }, 502);
            }
            const sheet = await response.json() as { values?: string[][] };
            const values = sheet.values || [];
            if (values.length < 1) return reply({ items: [], headers: [] });
            const headers = values[0].map((v) => String(v || "").trim());
            const items = await Promise.all(values.slice(1).filter((row) => row.some((v) => String(v || "").trim())).map(async (row, index) => {
              const record: Record<string, string> = {};
              headers.forEach((header, i) => {
                if (header) record[header] = String(row[i] || "");
              });
              const field = (pattern: RegExp) => headers.find((header) => pattern.test(header.trim().toLocaleLowerCase())) || "";
              const timestampHeader = field(/^timestamp$/);
              const nameHeader = field(/^(nama lengkap|nama)$/);
              const phoneHeader = field(/^(no\s*hp\s*\/\s*wa|no\.?\s*hp|nomor\s*(hp|wa)|whatsapp)$/);
              const identity = [record[timestampHeader] || "", record[nameHeader] || "", record[phoneHeader] || ""].map((v) => v.trim().toLocaleLowerCase()).join("\u001f");
              const fallback = headers.map((header) => record[header] || "").join("\u001f");
              const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity.replace(/\u001f/g, "") ? identity : fallback));
              record["_key"] = await digestHex(digest);
              record["_row"] = String(index + 2);
              return record;
            }));
            return reply({ headers, items, source: "Google Sheets", count: items.length });
          } catch (error) {
            const incidentId = logIncident("respondents_error", error, { path: url.pathname, stage: requestStage });
            const safeMessage = error instanceof Error ? error.message : "Kesalahan integrasi tidak diketahui.";
            return reply({ error: "Integrasi Google Sheets gagal: " + safeMessage + " (ID insiden: " + incidentId + ")" }, 503);
          }
        }

        if (url.pathname === "/api/remove-status-pesan" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan." }, 403);
          try {
            const token=await googleAccessToken(env);
            const base="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(env.GOOGLE_SHEET_ID||"");
            const metaRes=await fetch(base+"?fields=sheets.properties(title,sheetId)",{headers:{authorization:"Bearer "+token}});
            if(!metaRes.ok)throw new Error("Tidak dapat membaca spreadsheet (HTTP "+metaRes.status+").");
            const meta=await metaRes.json() as {sheets?:Array<{properties?:{title?:string;sheetId?:number}} >};
            const configured=(env.GOOGLE_SHEET_TAB||"From Response 1").trim();
            const norm=(v:string)=>v.toLocaleLowerCase().replace(/[^a-z0-9]/g,"");
            const tab=(meta.sheets||[]).find(x=>x.properties?.title===configured)|| (meta.sheets||[]).find(x=>norm(x.properties?.title||"")===norm(configured)) || (meta.sheets||[]).find(x=>/^(formresponses?1|fromresponses?1)$/.test(norm(x.properties?.title||"")));
            if(!tab||typeof tab.properties?.sheetId!="number")throw new Error("Tab respons tidak ditemukan.");
            const headRange=encodeURIComponent("'"+(tab.properties.title||"").replace(/'/g,"''")+"'!A1:AZ1");
            const headRes=await fetch(base+"/values/"+headRange,{headers:{authorization:"Bearer "+token}});
            if(!headRes.ok)throw new Error("Gagal membaca judul kolom.");
            const heads=await headRes.json() as {values?:string[][]};
            const idx=(heads.values?.[0]||[]).findIndex(x=>String(x||"").trim().toLocaleLowerCase()==="status pesan");
            if(idx<0)return reply({ok:true,removed:false,message:"Kolom Status Pesan tidak ditemukan; tidak ada kolom yang dihapus."});
            const del=await fetch(base+":batchUpdate",{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId:tab.properties.sheetId,startIndex:idx,endIndex:idx+1,dimension:"COLUMNS"}}}]})});
            if(!del.ok)throw new Error("Google Sheets menolak penghapusan kolom Status Pesan (HTTP "+del.status+").");
            await audit(env,admin.id,"remove_status_pesan_column");
            return reply({ok:true,removed:true,message:"Kolom Status Pesan dihapus. Kolom lainnya dipertahankan."});
          } catch(error) {
            const incidentId=logIncident("remove_status_pesan_failed",error,{path:url.pathname});
            return reply({error:(error instanceof Error?error.message:"Gagal menghapus kolom.")+" (ID insiden: "+incidentId+")"},503);
          }
        }

        if (url.pathname === "/api/respondent-field" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengubah data responden." }, 403);
          let body: { row?: number; field?: string; value?: string };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format permintaan tidak valid." }, 400); }
          const row = body.row;
          const field = typeof body.field === "string" ? body.field.trim() : "";
          const value = typeof body.value === "string" ? body.value.trim() : "";
          if (!Number.isInteger(row) || !row || row < 2 || row > 1001) return reply({ error: "Baris responden tidak valid." }, 400);
          if (!["DESIL", "Desil", "STATUS LAPORAN", "Status Laporan"].includes(field)) return reply({ error: "Kolom yang boleh diedit hanya Desil dan Status Laporan." }, 400);
          if (field.toLocaleLowerCase() === "desil" && value !== "" && !/^(0|[1-9]|10)$/.test(value)) return reply({ error: "Desil harus angka 0 sampai 10." }, 400);
          if (!value || value.length > 120) return reply({ error: "Nilai tidak boleh kosong dan maksimal 120 karakter." }, 400);
          try {
            const token = await googleAccessToken(env);
            const base = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID || "");
            const metaRes = await fetch(base + "?fields=sheets.properties(title,sheetId)", { headers: { authorization: "Bearer " + token } });
            if (!metaRes.ok) throw new Error("Tidak dapat membaca metadata spreadsheet (HTTP " + metaRes.status + ").");
            const meta = await metaRes.json() as { sheets?: Array<{properties?:{title?:string;sheetId?:number}}> };
            const titles = (meta.sheets || []).map(x => x.properties?.title || "");
            const configured = (env.GOOGLE_SHEET_TAB || "From Response 1").trim();
            const norm = (v:string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
            const tab = titles.find(x => x === configured) || titles.find(x => norm(x) === norm(configured)) || titles.find(x => /^(formresponses?1|fromresponses?1)$/.test(norm(x)));
            if (!tab) throw new Error("Tab respons tidak ditemukan.");
            const headRange = encodeURIComponent("'" + tab.replace(/'/g,"''") + "'!A1:AZ1");
            const headRes = await fetch(base + "/values/" + headRange, {headers:{authorization:"Bearer "+token}});
            if (!headRes.ok) throw new Error("Gagal membaca judul kolom (HTTP "+headRes.status+").");
            const headJson = await headRes.json() as {values?:string[][]};
            const headers = (headJson.values?.[0] || []).map(x=>String(x||"").trim());
            const idx = headers.findIndex(x=>x.toLocaleLowerCase()===field.toLocaleLowerCase());
            if (idx < 0) throw new Error("Kolom "+field+" tidak ditemukan pada tab respons.");
            let col = ""; let n = idx + 1;
            while (n > 0) { const rem=(n-1)%26; col=String.fromCharCode(65+rem)+col; n=Math.floor((n-1)/26); }
            const range = encodeURIComponent("'" + tab.replace(/'/g,"''") + "'!" + col + row);
            const put = await fetch(base + "/values/" + range + "?valueInputOption=USER_ENTERED", {method:"PUT",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({values:[[value]]})});
            if (!put.ok) { let msg=""; try { const e=await put.json() as {error?:{message?:string}}; msg=e.error?.message||""; } catch {} throw new Error("Gagal menyimpan ke Google Sheets (HTTP "+put.status+"). "+msg); }
            await audit(env, admin.id, "respondent_field_update");
            return reply({ok:true, value});
          } catch(error) {
            const incidentId=logIncident("respondent_field_update_failed",error,{path:url.pathname});
            return reply({error:(error instanceof Error?error.message:"Gagal menyimpan perubahan.")+" (ID insiden: "+incidentId+")"},503);
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
          await env.DB.prepare("INSERT INTO respondent_workflow(respondent_key,report_status,desil,template_choice,updated_by,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(respondent_key) DO UPDATE SET report_status=excluded.report_status,desil=excluded.desil,template_choice=excluded.template_choice,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(key, body.reportStatus, desil, template, admin.id).run();
          await audit(env, admin.id, "workflow_update");
          return reply({ ok: true });
        }

        if (url.pathname === "/api/push-config" && request.method === "GET") {
          return reply({ ok: true, enabled: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT), publicKey: env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT ? env.VAPID_PUBLIC_KEY : "" });
        }

        if (url.pathname === "/api/owner-profile" && (request.method === "GET" || request.method === "POST")) {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner") return reply({ error: "Hanya owner yang dapat mengakses profil owner." }, 403);
          await ensureFeatureSchema(env);
          if (request.method === "GET") {
            const profile = await env.DB.prepare("SELECT photo_data,photo_mime,employee_name,nip,address,phone,email,institution,updated_at FROM owner_profile WHERE id=1").first<Record<string, string>>();
            return reply({ ok: true, profile: profile || { photo_data: "", photo_mime: "", employee_name: admin.display_name || "", nip: "", address: "", phone: "", email: "", institution: "" } });
          }
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          let body: { photoData?: string; photoMime?: string; employeeName?: string; nip?: string; address?: string; phone?: string; email?: string; institution?: string };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format permintaan tidak valid." }, 400); }
          const textField = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
          const photoData = typeof body.photoData === "string" ? body.photoData : "";
          const photoMime = textField(body.photoMime, 40);
          if (photoData && (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photoData) || !["image/jpeg","image/png","image/webp"].includes(photoMime) || photoData.length > 420000)) {
            return reply({ error: "Foto profil harus JPEG, PNG, atau WebP. Pilih file asli maksimal 10 MB; dashboard akan mengoptimalkannya sebelum disimpan." }, 400);
          }
          const employeeName = textField(body.employeeName, 100);
          const nip = textField(body.nip, 40);
          const address = textField(body.address, 300);
          const phone = textField(body.phone, 40);
          const email = textField(body.email, 160);
          const institution = textField(body.institution, 160);
          if (employeeName.length < 2) return reply({ error: "Nama Pegawai wajib diisi minimal 2 karakter." }, 400);
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Format email belum valid." }, 400);
          await env.DB.prepare(`INSERT INTO owner_profile(id,photo_data,photo_mime,employee_name,nip,address,phone,email,institution,updated_at,updated_by)
            VALUES(1,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)
            ON CONFLICT(id) DO UPDATE SET photo_data=excluded.photo_data,photo_mime=excluded.photo_mime,employee_name=excluded.employee_name,nip=excluded.nip,address=excluded.address,phone=excluded.phone,email=excluded.email,institution=excluded.institution,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`)
            .bind(photoData, photoMime, employeeName, nip, address, phone, email, institution, admin.id).run();
          await audit(env, admin.id, "owner_profile_update");
          return reply({ ok: true, message: "Profil owner berhasil disimpan." });
        }

        if (url.pathname === "/api/notifications" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          await ensureFeatureSchema(env);
          const rows = await env.DB.prepare("SELECT id,title,body,action,created_at,read_at FROM dashboard_notifications ORDER BY id DESC LIMIT 30").all();
          const unread = await env.DB.prepare("SELECT COUNT(*) AS count FROM dashboard_notifications WHERE read_at IS NULL").first<{ count: number }>();
          return reply({ ok: true, items: rows.results || [], unread: unread?.count || 0 });
        }

        if (url.pathname === "/api/notifications/read" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          await ensureFeatureSchema(env);
          await env.DB.prepare("UPDATE dashboard_notifications SET read_at=CURRENT_TIMESTAMP WHERE read_at IS NULL").run();
          return reply({ ok: true });
        }

        if (url.pathname === "/api/push-test" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner") return reply({ error: "Hanya owner yang dapat menguji notifikasi." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return reply({ error: "Push notification belum dikonfigurasi di Cloudflare." }, 503);
          await ensureFeatureSchema(env);
          const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first<{ n: number }>();
          if (!count?.n) return reply({ error: "Belum ada perangkat yang berlangganan notifikasi. Aktifkan notifikasi HP terlebih dahulu." }, 409);
          await recordNotification(env, "Tes notifikasi Sahabat ODHIV Sumut", "Jika pesan ini muncul di ponsel, notifikasi push sudah tersambung.", "push_test");
          return reply({ ok: true, message: "Notifikasi tes dikirim ke perangkat yang terdaftar." });
        }

        if (url.pathname === "/api/push-subscriptions" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner") return reply({ error: "Hanya owner yang dapat mengaktifkan notifikasi perangkat." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return reply({ error: "Push notification belum dikonfigurasi di Cloudflare." }, 503);
          await ensureFeatureSchema(env);
          let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format langganan notifikasi tidak valid." }, 400); }
          const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
          const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
          const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
          let endpointUrl: URL;
          try { endpointUrl = new URL(endpoint); } catch { return reply({ error: "Alamat push tidak valid." }, 400); }
          if (endpointUrl.protocol !== "https:" || endpoint.length > 2048 || p256dh.length > 256 || auth.length > 128 || !p256dh || !auth) return reply({ error: "Data langganan push tidak valid." }, 400);
          const endpointHash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
          await env.DB.prepare(`INSERT INTO push_subscriptions(endpoint_hash,endpoint,p256dh,auth) VALUES(?,?,?,?)
            ON CONFLICT(endpoint_hash) DO UPDATE SET endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=CURRENT_TIMESTAMP`)
            .bind(endpointHash, endpoint, p256dh, auth).run();
          return reply({ ok: true, message: "Notifikasi perangkat berhasil diaktifkan." });
        }

        if (url.pathname === "/api/push-subscriptions" && request.method === "DELETE") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          await ensureFeatureSchema(env);
          let body: { endpoint?: string };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format permintaan tidak valid." }, 400); }
          const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
          if (!endpoint) return reply({ error: "Alamat langganan tidak valid." }, 400);
          const endpointHash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint_hash=?").bind(endpointHash).run();
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

    const assetResponse = await env.ASSETS.fetch(request);
    const assetHeaders = new Headers(assetResponse.headers);
    assetHeaders.set("x-content-type-options", "nosniff");
    assetHeaders.set("x-frame-options", "DENY");
    assetHeaders.set("referrer-policy", "no-referrer");
    assetHeaders.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (url.pathname === "/" || url.pathname.endsWith(".html")) {
      assetHeaders.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
      assetHeaders.set("pragma", "no-cache");
      assetHeaders.set("expires", "0");
    }
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers: assetHeaders,
    });
  },
};
