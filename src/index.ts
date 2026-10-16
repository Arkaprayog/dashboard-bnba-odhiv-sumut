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
import { safeNewsUrl } from "./news-url-policy.js";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TEAM_PROFILE_PHOTOS?: KVNamespace;
  APP_ORIGIN: string;
  SESSION_TTL_SECONDS?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SHEET_TAB?: string;
  GOOGLE_DRIVE_BACKUP_FOLDER_ID?: string;
  DRIVE_BACKUP_TOKEN?: string;
  OWNER_BOOTSTRAP_TOKEN?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_SUBJECT?: string;
}

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer", "permissions-policy": "camera=(), microphone=(), geolocation=()", "cross-origin-resource-policy": "same-origin", "x-permitted-cross-domain-policies": "none", "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };

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

function logIncident(scope: string, _error: unknown, context: Record<string, unknown> = {}) {
  const incidentId = crypto.randomUUID();
  // Never persist exception messages/stacks: provider errors can contain URLs,
  // query parameters, request data, or credentials. Keep only allowlisted metadata.
  const safeContext: Record<string, string | number | boolean> = {};
  for (const key of ["path", "method", "stage", "task"]) {
    const value = context[key];
    if (typeof value === "string" && value.length <= 80 && /^[a-zA-Z0-9_./:-]+$/.test(value)) {
      safeContext[key] = value;
    }
  }
  const providerStatus = context.providerStatus;
  if (typeof providerStatus === "number" && Number.isInteger(providerStatus) && providerStatus >= 100 && providerStatus <= 599) {
    safeContext.providerStatus = providerStatus;
  }
  const providerReason = context.providerReason;
  if (typeof providerReason === "string" && providerReason.length <= 80 && /^[a-zA-Z0-9_.:-]+$/.test(providerReason)) {
    safeContext.providerReason = providerReason;
  }
  console.error("application_incident", {
    incidentId,
    scope: /^[a-zA-Z0-9_:-]{1,80}$/.test(scope) ? scope : "unknown_incident",
    ...safeContext,
  });
  return incidentId;
}

function safeProviderHttpStatus(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  if (!match) return undefined;
  const status = Number(match[1]);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com"
      || host === "updates.push.services.mozilla.com"
      || host === "web.push.apple.com"
      || host.endsWith(".push.apple.com")
      || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
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
  const claim = enc({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
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


async function getOrCreateDriveFolder(token: string, name: string, parentId?: string): Promise<{ id: string; name: string; webViewLink?: string }> {
  const q = ["name = '" + name.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'", "mimeType = 'application/vnd.google-apps.folder'", "trashed = false"];
  if (parentId) q.push("'" + parentId.replace(/'/g, "\\'") + "' in parents");
  const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
  listUrl.searchParams.set("q", q.join(" and "));
  listUrl.searchParams.set("pageSize", "100");
  listUrl.searchParams.set("fields", "files(id,name,webViewLink)");
  const listResponse = await fetch(listUrl.toString(), { headers: { authorization: "Bearer " + token } });
  if (!listResponse.ok) throw new Error("Google Drive folder search failed (HTTP " + listResponse.status + ").");
  const listData = await listResponse.json() as { files?: Array<{ id?: string; name?: string; webViewLink?: string }> };
  const existing = (listData.files || []).find((file) => typeof file.id === "string" && file.id.length > 0);
  if (existing?.id) return { id: existing.id, name: existing.name || name, webViewLink: existing.webViewLink };

  const metadata: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) metadata.parents = [parentId];
  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!createResponse.ok) throw new Error("Google Drive folder create failed (HTTP " + createResponse.status + ").");
  const created = await createResponse.json() as { id?: string; name?: string; webViewLink?: string };
  if (!created.id) throw new Error("Google Drive folder create returned no ID.");
  return { id: created.id, name: created.name || name, webViewLink: created.webViewLink };
}

async function ensureDriveIntegrationSchema(env: Env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS integration_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function getDriveSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT setting_value FROM integration_settings WHERE setting_key=?").bind(key).first<{ setting_value: string }>();
  return row?.setting_value || null;
}

async function setDriveSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO integration_settings(setting_key,setting_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP`).bind(key, value).run();
}

function parsePrivateTeamPhotoReference(photoId: string): { key: string; mimeType: string } | null {
  const match = /^kv:v1:(image\/(?:jpeg|png|webp)):(team-profile\/[0-9a-f-]{36}\/[0-9a-f-]{36})$/i.exec(photoId);
  return match ? { mimeType: match[1].toLowerCase(), key: match[2] } : null;
}

async function readPrivateTeamPhoto(env: Env, photoId: string): Promise<Response | null> {
  const reference = parsePrivateTeamPhotoReference(photoId);
  // Existing profiles may still reference legacy private Google Drive files.
  if (!reference) return null;
  if (!env.TEAM_PROFILE_PHOTOS) {
    return new Response("Penyimpanan foto profil tidak tersedia", { status: 503, headers: NO_STORE });
  }
  const bytes = await env.TEAM_PROFILE_PHOTOS.get(reference.key, "arrayBuffer");
  if (!bytes) return new Response("Foto profil tidak tersedia", { status: 404, headers: NO_STORE });
  return new Response(bytes, {
    status: 200,
    headers: {
      ...NO_STORE,
      "content-type": reference.mimeType,
      "cache-control": "private, no-store",
    },
  });
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


async function ensureTeamSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_petugas (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      position TEXT NOT NULL CHECK (position IN ('PENDAMPING SEBAYA','PENJANGKAU LAPANGAN')),
      phone TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_petugas_v2 (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      position TEXT NOT NULL CHECK (position IN ('PENDAMPING LAPANGAN','PENJANGKAU LAPANGAN')),
      phone TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      profile_photo_id TEXT NOT NULL DEFAULT '',
      profile_completed INTEGER NOT NULL DEFAULT 0 CHECK (profile_completed IN (0,1)),
      password_hash TEXT NOT NULL DEFAULT '',
      password_salt TEXT NOT NULL DEFAULT ''
    )`),
    env.DB.prepare(`INSERT OR IGNORE INTO team_petugas_v2(id,display_name,position,phone,token_hash,active,created_at,created_by)
      SELECT id,display_name,CASE WHEN position='PENDAMPING SEBAYA' THEN 'PENDAMPING LAPANGAN' ELSE position END,phone,token_hash,active,created_at,created_by FROM team_petugas`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_sessions (
      id_hash TEXT PRIMARY KEY,
      petugas_id TEXT NOT NULL,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_submission_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_team_submission_ip_time ON team_submission_attempts(ip_hash,created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_team_petugas_active ON team_petugas(active,created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_team_petugas_v2_active ON team_petugas_v2(active,created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_team_sessions_petugas ON team_sessions(petugas_id,expires_at)"),
  ]);
  try { await env.DB.prepare("ALTER TABLE team_petugas_v2 ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''").run(); } catch { /* Already migrated. */ }
  try { await env.DB.prepare("ALTER TABLE team_petugas_v2 ADD COLUMN password_salt TEXT NOT NULL DEFAULT ''").run(); } catch { /* Already migrated. */ }
}

async function hashTeamToken(token: string): Promise<string> {
  return digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

type TeamSession = {
  id: string;
  display_name: string;
  position: string;
  phone: string;
  profile_photo_id: string;
  profile_completed: number;
  csrf_token: string;
  id_hash: string;
};

async function sessionTeam(request: Request, env: Env): Promise<TeamSession | null> {
  const raw = cookieValue(request, "team_session");
  if (!raw || raw.length > 200) return null;
  const idHash = await hashTeamToken(raw);
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(`SELECT p.id,p.display_name,p.position,p.phone,p.profile_photo_id,p.profile_completed,s.csrf_token,s.id_hash
    FROM team_sessions s JOIN team_petugas_v2 p ON p.id=s.petugas_id
    WHERE s.id_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND p.active=1`)
    .bind(idHash, now).first<TeamSession>();
}

async function sendPushToAll(env: Env, title: string, body: string, tag: string): Promise<{ configured: boolean; subscriptions: number; failed: number }> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) {
    return { configured: false, subscriptions: 0, failed: 0 };
  }
  const rows = await env.DB.prepare("SELECT endpoint_hash,endpoint,p256dh,auth FROM push_subscriptions").all<{
    endpoint_hash: string; endpoint: string; p256dh: string; auth: string;
  }>();
  const subscriptions = rows.results || [];
  if (!subscriptions.length) return { configured: true, subscriptions: 0, failed: 0 };
  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const results = await Promise.all(subscriptions.map(async (row): Promise<boolean> => {
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
        return false;
      }
      if (!response.ok) console.warn("push_delivery_failed", { status: response.status });
      return response.ok;
    } catch {
      // Do not log provider exception text: it may contain endpoint or subscription details.
      console.warn("push_delivery_failed", { stage: "request" });
      return false;
    }
  }));
  return { configured: true, subscriptions: subscriptions.length, failed: results.filter((ok) => !ok).length };
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
    catch { console.warn("notification_record_failed", { action, stage: "record" }); }
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
      // The Sahabat ODHIV Worker owns this single scheduled poller and its VAPID key.
      // Push-test requests and subscriptions are stored in the shared D1 database.
      try {
        await ensureFeatureSchema(env);
        const pendingTest = await env.DB.prepare("SELECT state_value FROM notification_state WHERE state_key='pending_push_test'").first<{ state_value: string }>();
        if (pendingTest) {
          const delivery = await sendPushToAll(env, "Tes notifikasi Sahabat ODHIV Sumut", "Tes push dari dashboard. Jika perangkat menampilkan pemberitahuan ini, push latar belakang berfungsi.", "push_test");
          // Keep the test request queued when signing keys are absent, there are no
          // enrolled devices, or any provider rejects delivery. Do not report success
          // by silently deleting an undelivered test.
          if (delivery.configured && delivery.subscriptions > 0 && delivery.failed === 0) {
            await env.DB.prepare("DELETE FROM notification_state WHERE state_key='pending_push_test'").run();
          } else {
            console.warn("push_test_pending", {
              configured: delivery.configured,
              subscriptions: delivery.subscriptions,
              failed: delivery.failed,
            });
          }
        }
      } catch (error) {
        logIncident("scheduled_push_test_failed", error, { task: "push_test_delivery" });
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
        if (!env.DB) return reply({ ok: false, service: "sahabatodhiv-sumut", error: "Database D1 belum dikonfigurasi." }, 503);
        await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return reply({ ok: true, service: "sahabatodhiv-sumut", database: "connected", mode: "ready" });
      } catch (error) {
        const incidentId = logIncident("health_check_failed", error, { path: url.pathname });
        return reply({ ok: false, service: "sahabatodhiv-sumut", error: "Pemeriksaan backend gagal.", incidentId }, 503);
      }
    }


    // Public news feed: only metadata and short excerpts from publisher RSS feeds.
    if (url.pathname === "/api/news" && request.method === "GET") {
      const feeds = [
        { name: "Kementerian Kesehatan RI", url: "https://kemkes.go.id/id/rss/article/rilis-berita", priority: "health" },
        { name: "Artikel Kesehatan Kemenkes", url: "https://kemkes.go.id/id/rss/article/artikel-kesehatan", priority: "health" },
        { name: "ANTARA Sumatera Utara", url: "https://sumut.antaranews.com/rss/terkini.xml", priority: "sumut" },
        { name: "ANTARA Sumatera Utara", url: "https://sumut.antaranews.com/rss/berita-sumut.xml", priority: "sumut" },
        { name: "ANTARA Nasional", url: "https://www.antaranews.com/rss/terkini.xml", priority: "national" },
      ];
      const decodeXml = (value: string) => value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([\da-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/\s+/g, " ").trim();
      const getTag = (block: string, tag: string) => {
        const match = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "i"));
        return match ? decodeXml(match[1]) : "";
      };
      const topicFor = (title: string, description: string, priority: string) => {
        const text = (title + " " + description).toLocaleLowerCase("id");
        if (/hiv|aids|odhiv|od.?hiv|antiretroviral|antiretroviral|tes hiv|stigma/.test(text)) return "HIV/AIDS";
        if (/kemensos|kementerian sosial|menteri sosial|rehabilitasi sosial/.test(text)) return "Kemensos";
        if (/bansos|bantuan sosial|perlindungan sosial|pkh|bpnt|kebijakan sosial/.test(text)) return "Bansos dan Kebijakan";
        if (/kemenkes|kementerian kesehatan|layanan kesehatan|puskesmas|rumah sakit|kesehatan/.test(text)) return "Kemenkes dan Layanan Kesehatan";
        if (priority === "sumut" || /sumatera utara|sumut|medan|deli serdang|pematangsiantar|tapanuli|simalungun|binjai|nias/.test(text)) return "Sumatera Utara";
        return priority === "health" ? "Kemenkes dan Layanan Kesehatan" : priority === "sumut" ? "Sumatera Utara" : "";
      };
      // RSS feeds are external input. Permit article links only on the trusted publisher domains.
      const results = await Promise.allSettled(feeds.map(async feed => {
        const response = await fetch(feed.url, { headers: { "accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8", "user-agent": "Sahabat-ODHIV-Sumut-News/1.0 (+public RSS reader)" }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(feed.name + " RSS HTTP " + response.status);
        const xml = await response.text();
        if (xml.length > 2_000_000) throw new Error(feed.name + " RSS terlalu besar");
        const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
        return blocks.map(block => {
          const title = getTag(block, "title");
          const linkMatch = block.match(/<link(?:\s[^>]*)?href=["']([^"']+)["'][^>]*\/?\s*>/i);
          const candidateUrl = getTag(block, "link") || linkMatch?.[1] || "";
          const articleUrl = safeNewsUrl(candidateUrl);
          const description = getTag(block, "description") || getTag(block, "summary") || getTag(block, "content:encoded") || getTag(block, "content");
          const published = getTag(block, "pubDate") || getTag(block, "published") || getTag(block, "updated") || getTag(block, "dc:date");
          const date = published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : "";
          const category = topicFor(title, description, feed.priority);
          return { title: title.slice(0, 300), summary: description.slice(0, 320), url: articleUrl, publishedAt: date, source: feed.name, category };
        }).filter(item => item.title && item.url && item.category);
      }));
      const articles = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
      const seen = new Set<string>();
      const unique = articles.filter(item => {
        const key = item.url.replace(/[?#].*$/, "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).slice(0, 60);
      const payload = { ok: true, items: unique, updatedAt: new Date().toISOString(), sourcesChecked: feeds.length, sourcesSucceeded: results.filter(result => result.status === "fulfilled").length };
      const response = new Response(JSON.stringify(payload), { headers: { ...NO_STORE, "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=900, s-maxage=900" } });
      return response;
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

          if (!/^[a-z0-9._-]{3,64}$/.test(username) || displayName.length < 2 || displayName.length > 100 || password.length < 14 || password.length > 1024 || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
            return reply({ error: "Data akun tidak valid. Gunakan username 3-64 karakter dan password minimal 14 karakter dengan angka serta simbol." }, 400);
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

          // Rate-limit by a one-way hash of the connecting IP, not one shared key.
          // This prevents one source from locking every administrator out while
          // avoiding storage of raw IP addresses in the login_attempts table.
          const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
          const ipHash = await digestHex(await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(clientIp),
          ));
          const loginKey = "ip:" + ipHash;
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

        if (url.pathname === "/api/respondent-photo-upload" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengunggah foto responden." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (!env.GOOGLE_SHEET_ID) return reply({ error: "Integrasi Google Sheets belum dikonfigurasi." }, 503);

          let form: FormData;
          try { form = await request.formData(); } catch { return reply({ error: "Form upload tidak valid." }, 400); }
          const rowText = String(form.get("row") || "");
          const field = String(form.get("field") || "").trim();
          const file = form.get("file");
          const row = Number(rowText);
          if (!Number.isInteger(row) || row < 2 || row > 1001) return reply({ error: "Baris responden tidak valid." }, 400);
          if (!(file instanceof File)) return reply({ error: "Pilih foto yang akan diunggah." }, 400);
          const allowedFileTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
          if (!allowedFileTypes.includes(file.type)) return reply({ error: "Format berkas harus JPEG, PNG, WebP, PDF, DOC, atau DOCX." }, 415);
          if (!file.size || file.size > 8 * 1024 * 1024) return reply({ error: "Ukuran berkas harus lebih dari 0 dan maksimal 8 MB." }, 413);
          const normalized = (v: string) => v.normalize("NFKD").toLocaleLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
          if (!/^foto(?:diri|ktp|kk|rumah)/.test(normalized(field))) return reply({ error: "Upload hanya diizinkan untuk kolom foto responden." }, 400);

          let uploadedId = "";
          try {
            const token = await googleAccessToken(env);
            const base = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID);
            const metaRes = await fetch(base + "?fields=sheets.properties.title", { headers: { authorization: "Bearer " + token } });
            if (!metaRes.ok) throw new Error("Tidak dapat membaca metadata spreadsheet (HTTP " + metaRes.status + ").");
            const meta = await metaRes.json() as { sheets?: Array<{ properties?: { title?: string } }> };
            const titles = (meta.sheets || []).map(x => x.properties?.title || "").filter(Boolean);
            const configured = (env.GOOGLE_SHEET_TAB || "From Response 1").trim();
            const tabNorm = (v: string) => v.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
            const tab = titles.find(x => x === configured) || titles.find(x => tabNorm(x) === tabNorm(configured)) || titles.find(x => /^(formresponses?1|fromresponses?1)$/.test(tabNorm(x)));
            if (!tab) throw new Error("Tab respons tidak ditemukan.");
            const quotedTab = "'" + tab.replace(/'/g, "''") + "'";
            const headerRange = encodeURIComponent(quotedTab + "!A1:AZ1");
            const headerRes = await fetch(base + "/values/" + headerRange, { headers: { authorization: "Bearer " + token } });
            if (!headerRes.ok) throw new Error("Gagal membaca judul kolom Google Sheets (HTTP " + headerRes.status + ").");
            const headerJson = await headerRes.json() as { values?: string[][] };
            const headers = (headerJson.values?.[0] || []).map(v => String(v || "").trim());
            const colIndex = headers.findIndex(v => v === field);
            if (colIndex < 0) throw new Error("Kolom foto tidak ditemukan di Google Sheets.");
            const currentRange = encodeURIComponent(quotedTab + "!A" + row + ":AZ" + row);
            const currentRes = await fetch(base + "/values/" + currentRange, { headers: { authorization: "Bearer " + token } });
            if (!currentRes.ok) throw new Error("Gagal memeriksa data foto saat ini (HTTP " + currentRes.status + ").");
            const currentJson = await currentRes.json() as { values?: string[][] };
            const currentValue = String(currentJson.values?.[0]?.[colIndex] || "").trim();
            const currentIdMatch = currentValue.match(/(?:\/file\/d\/|[?&]id=)([A-Za-z0-9_-]{10,200})/i);
            const bareId = /^[A-Za-z0-9_-]{10,200}$/.test(currentValue) ? currentValue : "";
            const existingId = currentIdMatch?.[1] || bareId;
            if (existingId) {
              const existingMeta = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(existingId) + "?fields=id,mimeType&supportsAllDrives=true", { headers: { authorization: "Bearer " + token } });
              if (existingMeta.ok) {
                const existingFile = await existingMeta.json() as { mimeType?: string };
                if (allowedFileTypes.includes((existingFile.mimeType || "").toLowerCase())) return reply({ error: "Berkas pada kolom ini masih dapat diakses. Upload pengganti hanya tersedia jika berkas lama kosong atau tidak dapat diakses." }, 409);
              }
            } else if (currentValue && !/^https?:\/\//i.test(currentValue)) {
              return reply({ error: "Kolom foto sudah berisi nilai yang tidak kosong. Periksa tautan lama sebelum menggantinya." }, 409);
            }

            const safeName = (file.name || "foto-responden").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "foto-responden";
            const metadata = { name: "SahabatODHIV-" + row + "-" + Date.now() + "-" + safeName, mimeType: file.type };
            const uploadForm = new FormData();
            uploadForm.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }));
            uploadForm.append("file", file, safeName);
            const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType", { method: "POST", headers: { authorization: "Bearer " + token }, body: uploadForm });
            if (!uploadRes.ok) {
              let detail = "";
              try { const payload = await uploadRes.json() as { error?: { message?: string } }; detail = payload.error?.message || ""; } catch {}
              throw new Error("Google Drive gagal menyimpan foto (HTTP " + uploadRes.status + "). " + detail);
            }
            const uploaded = await uploadRes.json() as { id?: string; mimeType?: string };
            uploadedId = uploaded.id || "";
            if (!uploadedId || uploaded.mimeType !== file.type) throw new Error("Google Drive tidak mengembalikan identitas berkas yang valid.");
            let col = ""; let n = colIndex + 1;
            while (n > 0) { const rem = (n - 1) % 26; col = String.fromCharCode(65 + rem) + col; n = Math.floor((n - 1) / 26); }
            const cellRange = encodeURIComponent(quotedTab + "!" + col + row);
            const urlValue = "https://drive.google.com/file/d/" + uploadedId + "/view";
            const put = await fetch(base + "/values/" + cellRange + "?valueInputOption=RAW", { method: "PUT", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ values: [[urlValue]] }) });
            if (!put.ok) {
              let detail = "";
              try { const payload = await put.json() as { error?: { message?: string } }; detail = payload.error?.message || ""; } catch {}
              throw new Error("Foto terunggah, tetapi Google Sheets gagal menyimpan tautannya (HTTP " + put.status + "). " + detail);
            }
            await audit(env, admin.id, "respondent_photo_upload");
            return reply({ ok: true, url: urlValue, message: "Berkas berhasil diunggah dan ditautkan ke Google Sheets." });
          } catch (error) {
            if (uploadedId) {
              try {
                const token = await googleAccessToken(env);
                await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(uploadedId), { method: "DELETE", headers: { authorization: "Bearer " + token } });
              } catch {}
            }
            const incidentId = logIncident("respondent_photo_upload_failed", error, { path: url.pathname, stage: requestStage });
            return reply({ error: (error instanceof Error ? error.message : "Foto gagal diunggah.") + " (ID insiden: " + incidentId + ")" }, 503);
          }
        }

        if (url.pathname === "/api/respondent-file" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengakses berkas responden." }, 403);
          const fileId = (url.searchParams.get("id") || "").trim();
          if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return reply({ error: "ID berkas tidak valid." }, 400);
          try {
            const token = await googleAccessToken(env);
            const driveUrl = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId);
            const metaResponse = await fetch(driveUrl + "?fields=id,name,mimeType,size&supportsAllDrives=true", { headers: { authorization: "Bearer " + token } });
            if (!metaResponse.ok) return reply({ error: "Google Drive tidak dapat membaca metadata berkas (HTTP " + metaResponse.status + ")." }, 502);
            const metadata = await metaResponse.json() as { name?: string; mimeType?: string; size?: string };
            const mime = (metadata.mimeType || "").toLowerCase();
            const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
            if (!allowed.includes(mime)) return reply({ error: "Jenis berkas tidak diizinkan." }, 415);
            if (metadata.size && Number(metadata.size) > 8 * 1024 * 1024) return reply({ error: "Berkas melebihi batas 8 MB." }, 413);
            const fileResponse = await fetch(driveUrl + "?alt=media&supportsAllDrives=true", { headers: { authorization: "Bearer " + token } });
            if (!fileResponse.ok || !fileResponse.body) return reply({ error: "Google Drive gagal mengirim berkas (HTTP " + fileResponse.status + ")." }, 502);
            const safeName = (metadata.name || "berkas-responden").replace(/[\\r\\n"]/g, "_").slice(0, 140);
            const disposition = mime.startsWith("image/") || mime === "application/pdf" ? "inline" : "attachment";
            return new Response(fileResponse.body, { status: 200, headers: { ...NO_STORE, "content-type": mime, "content-disposition": disposition + '; filename="' + safeName + '"', "content-security-policy": "default-src 'none'; sandbox", "x-content-type-options": "nosniff" } });
          } catch (error) {
            const incidentId = logIncident("respondent_file_error", error, { path: url.pathname });
            return reply({ error: "Berkas responden gagal dimuat. ID insiden: " + incidentId }, 502);
          }
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



        // Team management: administrators register field staff and issue revocable,
        // password-free bearer links. Only token hashes are stored in D1.
        if (url.pathname === "/api/team-petugas" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login ke dashboard admin." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengelola tim petugas." }, 403);
          await ensureTeamSchema(env);
          const rows = await env.DB.prepare("SELECT id,display_name,position,phone,active,created_at,profile_completed,CASE WHEN profile_photo_id<>'' THEN 1 ELSE 0 END AS has_profile_photo FROM team_petugas_v2 ORDER BY created_at DESC LIMIT 300").all();
          return reply({ items: rows.results || [], csrfToken: admin.csrf_token });
        }

        if (url.pathname === "/api/team-petugas" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login ke dashboard admin." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengelola tim petugas." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          let body: { name?: unknown; position?: unknown; phone?: unknown; password?: unknown };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format data petugas tidak valid." }, 400); }
          const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
          const position = typeof body.position === "string" ? body.position.trim().toUpperCase() : "";
          const phone = typeof body.phone === "string" ? body.phone.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";
          if (name.length < 2 || name.length > 120 ||
              !["PENDAMPING LAPANGAN", "PENJANGKAU LAPANGAN"].includes(position) ||
              !/^\+?[0-9 ()-]{8,30}$/.test(phone) || password.length < 8 || password.length > 128) {
            return reply({ error: "Nama, jabatan, nomor HP/WA, atau kata sandi belum valid. Kata sandi minimal 8 karakter." }, 400);
          }
          await ensureTeamSchema(env);
          const token = b64(crypto.getRandomValues(new Uint8Array(32)));
          const id = crypto.randomUUID();
          const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
          const passwordDigest = await passwordHash(password, passwordSalt);
          await env.DB.prepare("INSERT INTO team_petugas_v2(id,display_name,position,phone,token_hash,active,created_by,password_hash,password_salt) VALUES(?,?,?,?,?,1,?,?,?)")
            .bind(id, name, position, phone, await hashTeamToken(token), admin.id, [...passwordDigest].map((value) => value.toString(16).padStart(2, "0")).join(""), [...passwordSalt].map((value) => value.toString(16).padStart(2, "0")).join("")).run();
          await audit(env, admin.id, "team_petugas_create");
          const origin = normalizeOrigin(env.APP_ORIGIN || new URL(request.url).origin);
          return reply({ ok: true, item: { id, display_name: name, position, phone, active: 1 }, link: origin + "/tim-pendataan.html?token=" + encodeURIComponent(token) }, 201);
        }

        if (url.pathname === "/api/team-petugas/revoke" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login ke dashboard admin." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengelola tim petugas." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          let body: { id?: unknown };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format permintaan tidak valid." }, 400); }
          const id = typeof body.id === "string" ? body.id : "";
          if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "Identitas petugas tidak valid." }, 400);
          await ensureTeamSchema(env);
          const result = await env.DB.prepare("UPDATE team_petugas_v2 SET active=0 WHERE id=? AND active=1").bind(id).run();
          if (!result.meta.changes) return reply({ error: "Petugas tidak ditemukan atau sudah dinonaktifkan." }, 404);
          await audit(env, admin.id, "team_petugas_revoke");
          return reply({ ok: true });
        }


        if (url.pathname === "/api/team-petugas-photo" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return new Response("Unauthorized", { status: 401, headers: NO_STORE });
          if (admin.role !== "owner" && admin.role !== "admin") return new Response("Forbidden", { status: 403, headers: NO_STORE });
          const id = (url.searchParams.get("id") || "").trim();
          if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404, headers: NO_STORE });
          await ensureTeamSchema(env);
          const petugas = await env.DB.prepare("SELECT profile_photo_id FROM team_petugas_v2 WHERE id=?").bind(id).first<{ profile_photo_id: string }>();
          if (!petugas?.profile_photo_id) return new Response("Not found", { status: 404, headers: NO_STORE });
          try {
            const privatePhoto = await readPrivateTeamPhoto(env, petugas.profile_photo_id);
            if (privatePhoto) return privatePhoto;
            const accessToken = await googleAccessToken(env);
            const driveUrl = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(petugas.profile_photo_id);
            const metadataResponse = await fetch(driveUrl + "?fields=mimeType&supportsAllDrives=true", { headers: { authorization: "Bearer " + accessToken } });
            if (!metadataResponse.ok) return new Response("Foto profil tidak tersedia", { status: 502, headers: NO_STORE });
            const metadata = await metadataResponse.json() as { mimeType?: string };
            const mime = (metadata.mimeType || "").toLowerCase();
            if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return new Response("Format foto profil tidak valid", { status: 415, headers: NO_STORE });
            const fileResponse = await fetch(driveUrl + "?alt=media&supportsAllDrives=true", { headers: { authorization: "Bearer " + accessToken } });
            if (!fileResponse.ok || !fileResponse.body) return new Response("Foto profil tidak tersedia", { status: 502, headers: NO_STORE });
            return new Response(fileResponse.body, { status: 200, headers: { ...NO_STORE, "content-type": mime, "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" } });
          } catch (error) {
            logIncident("team_staff_photo_read_failed", error, { path: url.pathname });
            return new Response("Foto profil gagal dimuat", { status: 502, headers: NO_STORE });
          }
        }

        if (url.pathname === "/api/team-submissions" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login ke dashboard admin." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengakses pendataan tim." }, 403);
          if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            return reply({ error: "Integrasi Google Sheets/Drive belum dikonfigurasi." }, 503);
          }
          try {
            const accessToken = await googleAccessToken(env);
            const base = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID);
            const metadataResponse = await fetch(base + "?fields=sheets.properties.title", { headers: { authorization: "Bearer " + accessToken } });
            if (!metadataResponse.ok) return reply({ error: "Tidak dapat membaca daftar tab Google Sheets (HTTP " + metadataResponse.status + ")." }, 502);
            const metadata = await metadataResponse.json() as { sheets?: Array<{ properties?: { title?: string } }> };
            if (!(metadata.sheets || []).some(sheet => sheet.properties?.title === "Kuisioner Owner")) {
              return reply({ items: [], csrfToken: admin.csrf_token });
            }
            const range = encodeURIComponent("'Kuisioner Owner'!A1:O1000");
            const response = await fetch(base + "/values/" + range + "?valueRenderOption=FORMATTED_VALUE", { headers: { authorization: "Bearer " + accessToken } });
            if (!response.ok) return reply({ error: "Data pendataan tim belum dapat dibaca dari Google Sheets (HTTP " + response.status + ")." }, 502);
            const payload = await response.json() as { values?: string[][] };
            const rows = payload.values || [];
            if (!rows.length) return reply({ items: [], csrfToken: admin.csrf_token });
            const headers = rows[0].map(value => String(value || "").trim());
            const get = (row: string[], label: string, fallbackIndex: number) => {
              const index = headers.findIndex(value => value.toLocaleLowerCase() === label.toLocaleLowerCase());
              return String(row[index >= 0 ? index : fallbackIndex] || "");
            };
            const driveId = (value: string) => {
              const raw = String(value || "").trim();
              if (/^[A-Za-z0-9_-]{10,200}$/.test(raw)) return raw;
              const match = raw.match(/(?:\/file\/d\/|[?&]id=)([A-Za-z0-9_-]{10,200})/i);
              return match?.[1] || "";
            };
            const items = rows.slice(1).map((row, index) => {
              const teamName = get(row, "TELAH DIDATA OLEH", 12).trim();
              if (!teamName) return null;
              return {
                row: index + 2,
                timestamp: get(row, "Timestamp", 0),
                name: get(row, "NAMA LENGKAP", 1),
                nik: get(row, "NIK", 2),
                age: get(row, "USIA", 3),
                gender: get(row, "JENIS KELAMIN", 4),
                address: get(row, "ALAMAT DOMISILI SAAT INI", 5),
                city: get(row, "KOTA DOMISILI SAAT INI", 6),
                job: get(row, "PEKERJAAN", 7),
                phone: get(row, "NO HP/WA", 8),
                selfPhotoId: driveId(get(row, "FOTO DIRI", 9)),
                ktpPhotoId: driveId(get(row, "FOTO KTP", 10)),
                assistance: get(row, "JENIS BANTUAN", 11),
                teamName,
                teamPosition: get(row, "POSISI JABATAN PETUGAS", 13),
                teamPhone: get(row, "NO HP/WA PETUGAS", 14),
              };
            }).filter(item => item !== null).reverse();
            return reply({ items, csrfToken: admin.csrf_token });
          } catch (error) {
            const incidentId = logIncident("team_submissions_load_failed", error, { path: url.pathname });
            return reply({ error: "Data pendataan tim gagal dimuat. ID insiden: " + incidentId }, 503);
          }
        }

        if (url.pathname === "/api/team-login" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          let body: { token?: unknown; name?: unknown; phone?: unknown; password?: unknown };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format login tidak valid." }, 400); }
          const token = typeof body.token === "string" ? body.token.trim() : "";
          const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
          const phone = typeof body.phone === "string" ? body.phone.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";
          await ensureTeamSchema(env);
          type TeamLoginRow = { id: string; display_name: string; position: string; phone: string; profile_completed: number; password_hash: string; password_salt: string };
          let petugas: TeamLoginRow | null = null;
          if (token.length >= 40 && token.length <= 100 && name.length >= 2 && name.length <= 120) {
            const inviteHash = await hashTeamToken(token);
            petugas = await env.DB.prepare("SELECT id,display_name,position,phone,profile_completed,password_hash,password_salt FROM team_petugas_v2 WHERE token_hash=? AND active=1")
              .bind(inviteHash).first<TeamLoginRow>();
            const normalizeName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
            if (!petugas || normalizeName(name) !== normalizeName(petugas.display_name)) {
              return reply({ error: "Nama tidak cocok dengan petugas yang terdaftar pada tautan ini." }, 401);
            }
            if (petugas.profile_completed) return reply({ error: "Tautan pendaftaran ini sudah digunakan. Login menggunakan nomor HP/WA dan kata sandi dari owner." }, 401);
          } else {
            if (!/^\+?[0-9 ()-]{8,30}$/.test(phone) || password.length < 8 || password.length > 128) {
              return reply({ error: "Masukkan nomor HP/WA dan kata sandi yang diberikan owner." }, 400);
            }
            const candidates = await env.DB.prepare("SELECT id,display_name,position,phone,profile_completed,password_hash,password_salt FROM team_petugas_v2 WHERE active=1 ORDER BY created_at DESC LIMIT 500").all<TeamLoginRow>();
            for (const candidate of candidates.results || []) {
              if (candidate.phone.replace(/\D/g, "") !== phone.replace(/\D/g, "") || !candidate.password_hash || !candidate.password_salt) continue;
              const actual = await passwordHash(password, unhex(candidate.password_salt));
              const expected = unhex(candidate.password_hash);
              if (actual.length === expected.length && actual.every((value, index) => value === expected[index])) { petugas = candidate; break; }
            }
            if (!petugas) return reply({ error: "Nomor HP/WA atau kata sandi tidak cocok." }, 401);
          }
          const rawSession = b64(crypto.getRandomValues(new Uint8Array(32)));
          const idHash = await hashTeamToken(rawSession);
          const csrfToken = b64(crypto.getRandomValues(new Uint8Array(24)));
          const now = Math.floor(Date.now() / 1000);
          const ttl = Math.min(86400, Math.max(900, Number(env.SESSION_TTL_SECONDS || "28800") || 28800));
          await env.DB.prepare("DELETE FROM team_sessions WHERE expires_at<? OR revoked_at IS NOT NULL").bind(now).run();
          await env.DB.prepare("INSERT INTO team_sessions(id_hash,petugas_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)")
            .bind(idHash, petugas.id, csrfToken, now + ttl, now).run();
          return reply({ ok: true, csrfToken, profileCompleted: Boolean(petugas.profile_completed), petugas: { name: petugas.display_name, position: petugas.position, phone: petugas.phone } }, 200, {
            "set-cookie": "team_session=" + encodeURIComponent(rawSession) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + ttl,
          });
        }

        if (url.pathname === "/api/team-me" && request.method === "GET") {
          await ensureTeamSchema(env);
          const petugas = await sessionTeam(request, env);
          if (!petugas) return reply({ error: "Sesi petugas berakhir. Buka kembali tautan dari admin." }, 401);
          return reply({ ok: true, csrfToken: petugas.csrf_token, profileCompleted: Boolean(petugas.profile_completed && petugas.profile_photo_id), petugas: { name: petugas.display_name, position: petugas.position, phone: petugas.phone, hasPhoto: Boolean(petugas.profile_photo_id) } });
        }

        if (url.pathname === "/api/team-profile" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          await ensureTeamSchema(env);
          const petugas = await sessionTeam(request, env);
          if (!petugas) return reply({ error: "Sesi petugas berakhir. Buka kembali tautan dari admin." }, 401);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== petugas.csrf_token) return reply({ error: "Token keamanan tidak valid. Muat ulang halaman." }, 403);
          if (petugas.profile_completed) return reply({ error: "Profil sudah terdaftar. Silakan login kembali untuk menggunakan akun tim kerja." }, 409);
          const contentLength = Number(request.headers.get("content-length") || "0");
          if (contentLength > 11 * 1024 * 1024) return reply({ error: "Ukuran foto profil melebihi batas 10 MB." }, 413);
          let form: FormData;
          try { form = await request.formData(); } catch { return reply({ error: "Formulir profil tidak valid." }, 400); }
          const name = String(form.get("namaAnggota") || petugas.display_name).trim().replace(/\s+/g, " ");
          const position = String(form.get("jabatan") || petugas.position).trim().toUpperCase();
          const phone = String(form.get("nomorHpWa") || petugas.phone).trim();
          if (name.length < 2 || name.length > 120 || !["PENDAMPING LAPANGAN", "PENJANGKAU LAPANGAN"].includes(position) || !/^\+?[0-9 ()-]{8,30}$/.test(phone)) {
            return reply({ error: "Nama anggota, jabatan, atau nomor HP/WA belum valid." }, 400);
          }
          const file = form.get("fotoProfil");
          if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
            return reply({ error: "Foto profil wajib berupa JPG, PNG, atau WebP dan maksimal 10 MB." }, 400);
          }
          if (!env.TEAM_PROFILE_PHOTOS) return reply({ error: "Penyimpanan foto profil belum aktif. Hubungi admin." }, 503);
          const objectKey = "team-profile/" + petugas.id + "/" + crypto.randomUUID();
          const newReference = "kv:v1:" + file.type + ":" + objectKey;
          let objectWritten = false;
          let databaseCommitted = false;
          let stage = "kv_write";
          try {
            await env.TEAM_PROFILE_PHOTOS.put(objectKey, await file.arrayBuffer());
            objectWritten = true;
            stage = "d1_commit";
            const rotatedInvite = b64(crypto.getRandomValues(new Uint8Array(32)));
            const saved = await env.DB.prepare("UPDATE team_petugas_v2 SET display_name=?,position=?,phone=?,profile_photo_id=?,profile_completed=1,token_hash=? WHERE id=? AND active=1 AND profile_completed=0")
              .bind(name, position, phone, newReference, await hashTeamToken(rotatedInvite), petugas.id).run();
            if (saved.meta.changes !== 1) throw new Error("Petugas tidak aktif atau profil tidak dapat diperbarui.");
            databaseCommitted = true;

            // Clean up the previous private KV object only after the new reference is committed.
            const previous = parsePrivateTeamPhotoReference(petugas.profile_photo_id);
            if (previous) {
              try { await env.TEAM_PROFILE_PHOTOS.delete(previous.key); } catch { /* Best-effort cleanup; the new profile is already saved. */ }
            }
            return reply({ ok: true, message: "Profil berhasil dilengkapi." });
          } catch (error) {
            if (objectWritten && !databaseCommitted) {
              try { await env.TEAM_PROFILE_PHOTOS.delete(objectKey); } catch { /* Best-effort cleanup of an unreferenced upload. */ }
            }
            const incidentId = logIncident("team_profile_upload_failed", error, { path: url.pathname, stage });
            return reply({ error: "Foto profil gagal disimpan. ID insiden: " + incidentId }, 502);
          }
        }

        if (url.pathname === "/api/team-profile-photo" && request.method === "GET") {
          await ensureTeamSchema(env);
          const petugas = await sessionTeam(request, env);
          if (!petugas) return new Response("Unauthorized", { status: 401, headers: NO_STORE });
          if (!petugas.profile_photo_id) return new Response("Not found", { status: 404, headers: NO_STORE });
          try {
            const privatePhoto = await readPrivateTeamPhoto(env, petugas.profile_photo_id);
            if (privatePhoto) return privatePhoto;
            const accessToken = await googleAccessToken(env);
            const response = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(petugas.profile_photo_id) + "?alt=media", { headers: { authorization: "Bearer " + accessToken } });
            if (!response.ok) return new Response("Foto profil tidak tersedia", { status: 502, headers: NO_STORE });
            const type = (response.headers.get("content-type") || "").toLowerCase();
            if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return new Response("Format foto profil tidak valid", { status: 502, headers: NO_STORE });
            return new Response(response.body, { status: 200, headers: { "content-type": type, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer", "cross-origin-resource-policy": "same-origin", "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" } });
          } catch (error) {
            const incidentId = logIncident("team_profile_photo_read_failed", error, { path: url.pathname });
            return new Response("Foto profil gagal dimuat. ID insiden: " + incidentId, { status: 502, headers: NO_STORE });
          }
        }

        if (url.pathname === "/api/team-logout" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          await ensureTeamSchema(env);
          const petugas = await sessionTeam(request, env);
          if (petugas) {
            const csrf = request.headers.get("X-CSRF-Token");
            if (!csrf || csrf !== petugas.csrf_token) return reply({ error: "Token keamanan tidak valid." }, 403);
            await env.DB.prepare("UPDATE team_sessions SET revoked_at=? WHERE id_hash=? AND revoked_at IS NULL")
              .bind(Math.floor(Date.now() / 1000), petugas.id_hash).run();
          }
          return reply({ ok: true }, 200, { "set-cookie": "team_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
        }

        if (url.pathname === "/api/team-questionnaire" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          await ensureTeamSchema(env);
          const petugas = await sessionTeam(request, env);
          if (!petugas) return reply({ error: "Sesi petugas berakhir. Buka kembali tautan dari admin." }, 401);
          if (!petugas.profile_completed || !petugas.profile_photo_id) return reply({ error: "Lengkapi foto profil sebelum melakukan pendataan." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== petugas.csrf_token) return reply({ error: "Token keamanan tidak valid. Muat ulang halaman." }, 403);
          const contentLength = Number(request.headers.get("content-length") || "0");
          if (contentLength > 18 * 1024 * 1024) return reply({ error: "Total ukuran kiriman terlalu besar. Maksimal 8 MB per foto." }, 413);

          const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
          const ipHash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientIp)));
          const now = Math.floor(Date.now() / 1000);
          await env.DB.prepare("DELETE FROM team_submission_attempts WHERE created_at<?").bind(now - 86400).run();
          const attempts = await env.DB.prepare("SELECT COUNT(*) AS n FROM team_submission_attempts WHERE ip_hash=? AND created_at>?")
            .bind(ipHash, now - 3600).first<{ n: number }>();
          if ((attempts?.n || 0) >= 60) return reply({ error: "Batas pengiriman sementara tercapai. Coba kembali nanti." }, 429, { "retry-after": "3600" });
          await env.DB.prepare("INSERT INTO team_submission_attempts(ip_hash,created_at) VALUES(?,?)").bind(ipHash, now).run();

          if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            return reply({ error: "Integrasi penyimpanan belum siap. Hubungi admin; data belum dikirim." }, 503);
          }
          let form: FormData;
          try { form = await request.formData(); } catch { return reply({ error: "Format formulir tidak valid." }, 400); }
          const get = (key: string, max: number) => String(form.get(key) || "").trim().slice(0, max);
          const nama = get("namaLengkap", 160);
          const nik = get("nik", 16);
          const usiaText = get("usia", 3);
          const usia = Number(usiaText);
          const gender = get("jenisKelamin", 20);
          const alamat = get("alamatDomisili", 400);
          const kota = get("kotaDomisili", 120);
          const pekerjaan = get("pekerjaan", 160);
          const phone = get("noHpWa", 30);
          const bantuanValues = form.getAll("jenisBantuan").map(value => String(value).trim()).filter(value => ["BANTUAN NUTRISI", "BANTUAN KEWIRAUSAHAAN"].includes(value));
          const bantuan = [...new Set(bantuanValues)].join(", ");
          const timestamp = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
          const selfPhoto = form.get("fotoDiri");
          const ktpPhoto = form.get("fotoKtp");
          if (!nama || !/^\d{16}$/.test(nik) || !Number.isInteger(usia) || usia < 0 || usia > 120 ||
              !["Laki-laki", "Perempuan"].includes(gender) || !alamat || !kota || !pekerjaan ||
              !/^\+?[0-9 ()-]{8,30}$/.test(phone) || !bantuan) {
            return reply({ error: "Periksa kembali isian wajib. NIK harus 16 digit, usia 0–120, dan pilih minimal satu jenis bantuan." }, 400);
          }
          const validPhoto = (value: FormDataEntryValue | null): value is File =>
            value instanceof File && ["image/jpeg", "image/png", "image/webp"].includes(value.type) && value.size > 0 && value.size <= 8 * 1024 * 1024;
          if (!validPhoto(selfPhoto) || !validPhoto(ktpPhoto)) {
            return reply({ error: "Foto diri dan KTP wajib diambil/diunggah sebagai JPG, PNG, atau WebP, maksimal 8 MB per foto." }, 400);
          }

          const uploadedIds: string[] = [];
          let accessToken = "";
          try {
            requestStage = "google_access_token";
            accessToken = await googleAccessToken(env);
            const uploadPrivatePhoto = async (photo: File, label: string) => {
              const safeName = (photo.name || label).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || label;
              const metadata = { name: "TimPendataan-" + petugas.id + "-" + Date.now() + "-" + label + "-" + safeName, mimeType: photo.type };
              const uploadForm = new FormData();
              uploadForm.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }));
              uploadForm.append("file", photo, safeName);
              requestStage = label === "foto-diri" ? "drive_upload_self_photo" : "drive_upload_ktp_photo";
              const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType", {
                method: "POST", headers: { authorization: "Bearer " + accessToken }, body: uploadForm,
              });
              if (!response.ok) throw new Error("Google Drive gagal menyimpan foto " + label + " (HTTP " + response.status + ").");
              const uploaded = await response.json() as { id?: string; mimeType?: string };
              if (!uploaded.id || uploaded.mimeType !== photo.type) throw new Error("Google Drive tidak mengembalikan identitas foto yang valid.");
              uploadedIds.push(uploaded.id);
              return "https://drive.google.com/file/d/" + uploaded.id + "/view";
            };

            const selfPhotoUrl = await uploadPrivatePhoto(selfPhoto, "foto-diri");
            const ktpPhotoUrl = await uploadPrivatePhoto(ktpPhoto, "foto-ktp");
            const spreadsheetBase = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID);
            requestStage = "sheets_read_metadata";
            const metadataResponse = await fetch(spreadsheetBase + "?fields=sheets.properties.title,sheets.properties.sheetId", { headers: { authorization: "Bearer " + accessToken } });
            if (!metadataResponse.ok) throw new Error("Tidak dapat membaca metadata Google Sheets (HTTP " + metadataResponse.status + ").");
            const metadata = await metadataResponse.json() as { sheets?: Array<{ properties?: { title?: string; sheetId?: number } }> };
            let ownerTab = (metadata.sheets || []).find(sheet => sheet.properties?.title === "Kuisioner Owner");
            if (!ownerTab) {
              requestStage = "sheets_create_tab";
              const createResponse = await fetch(spreadsheetBase + ":batchUpdate", {
                method: "POST", headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
                body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "Kuisioner Owner" } } }] }),
              });
              if (!createResponse.ok) throw new Error("Gagal menyiapkan tab Kuisioner Owner (HTTP " + createResponse.status + ").");
              const created = await createResponse.json() as { replies?: Array<{ addSheet?: { properties?: { sheetId?: number; title?: string } } }> };
              ownerTab = { properties: created.replies?.[0]?.addSheet?.properties || { title: "Kuisioner Owner" } };
            }
            const tabName = "'Kuisioner Owner'";
            const headers = ["Timestamp", "NAMA LENGKAP", "NIK", "USIA", "JENIS KELAMIN", "ALAMAT DOMISILI SAAT INI", "KOTA DOMISILI SAAT INI", "PEKERJAAN", "NO HP/WA", "FOTO DIRI", "FOTO KTP", "JENIS BANTUAN", "TELAH DIDATA OLEH", "POSISI JABATAN PETUGAS", "NO HP/WA PETUGAS"];
            const headerRange = encodeURIComponent(tabName + "!A1:O1");
            requestStage = "sheets_read_headers";
            const headerCheck = await fetch(spreadsheetBase + "/values/" + headerRange, { headers: { authorization: "Bearer " + accessToken } });
            if (!headerCheck.ok) throw new Error("Gagal memeriksa judul kolom Kuisioner Owner (HTTP " + headerCheck.status + ").");
            const headerData = await headerCheck.json() as { values?: string[][] };
            const existingHeaders = headerData.values?.[0] || [];
            if (!existingHeaders.some(value => String(value || "").trim())) {
              requestStage = "sheets_write_headers";
              const writeHeader = await fetch(spreadsheetBase + "/values/" + headerRange + "?valueInputOption=RAW", {
                method: "PUT", headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
                body: JSON.stringify({ values: [headers] }),
              });
              if (!writeHeader.ok) throw new Error("Gagal menyiapkan judul kolom Kuisioner Owner (HTTP " + writeHeader.status + ").");
            } else {
              const attributionHeaders = existingHeaders.slice(12, 15).map(value => String(value || "").trim());
              if (attributionHeaders.every(value => !value)) {
                requestStage = "sheets_write_attribution_headers";
                const writeAttribution = await fetch(spreadsheetBase + "/values/" + encodeURIComponent(tabName + "!M1:O1") + "?valueInputOption=RAW", {
                  method: "PUT", headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
                  body: JSON.stringify({ values: [headers.slice(12, 15)] }),
                });
                if (!writeAttribution.ok) throw new Error("Gagal menyiapkan kolom atribusi petugas (HTTP " + writeAttribution.status + ").");
              } else if (attributionHeaders.some((value, index) => value !== headers[index + 12])) {
                throw new Error("Kolom atribusi petugas pada Kuisioner Owner tidak sesuai. Periksa header M1:O1.");
              }
            }
            const appendRange = encodeURIComponent(tabName + "!A:O");
            requestStage = "sheets_append_submission";
            const appendResponse = await fetch(spreadsheetBase + "/values/" + appendRange + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", {
              method: "POST", headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
              body: JSON.stringify({ majorDimension: "ROWS", values: [[timestamp, nama, nik, String(usia), gender, alamat, kota, pekerjaan, phone, selfPhotoUrl, ktpPhotoUrl, bantuan, petugas.display_name, petugas.position, petugas.phone]] }),
            });
            if (!appendResponse.ok) throw new Error("Google Sheets gagal menyimpan data pendataan (HTTP " + appendResponse.status + ").");
            try {
              await env.DB.prepare("INSERT INTO audit_log(admin_id,action,target_type,target_id,detail_json) VALUES(NULL,'team_questionnaire_submit','team_petugas',?,?)")
                .bind(petugas.id, JSON.stringify({ position: petugas.position })).run();
            } catch {
              console.warn("team_submission_audit_failed");
            }
            return reply({ ok: true, message: "Pendataan berhasil dikirim dan terhubung ke dashboard kuesioner.", timestamp, teamName: petugas.display_name });
          } catch (error) {
            if (accessToken) for (const id of uploadedIds) {
              try { await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id), { method: "DELETE", headers: { authorization: "Bearer " + accessToken } }); } catch {}
            }
            const incidentId = logIncident("team_questionnaire_submit_failed", error, { path: url.pathname, stage: requestStage, providerStatus: safeProviderHttpStatus(error) });
            return reply({ error: "Pendataan belum berhasil disimpan. Periksa koneksi lalu coba lagi. ID insiden: " + incidentId }, 503);
          }
        }

        if (url.pathname === "/api/owner-questionnaire" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner") return reply({ error: "Kuesioner ini hanya dapat digunakan oleh owner." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            return reply({ error: "Integrasi Google Sheets/Drive belum dikonfigurasi." }, 503);
          }

          let form: FormData;
          try { form = await request.formData(); } catch { return reply({ error: "Data formulir tidak valid." }, 400); }
          const get = (key: string, max: number) => String(form.get(key) || "").trim().slice(0, max);
          const nama = get("namaLengkap", 160);
          const nik = get("nik", 16);
          const usiaText = get("usia", 3);
          const usia = Number(usiaText);
          const gender = get("jenisKelamin", 20);
          const alamat = get("alamatDomisili", 400);
          const kota = get("kotaDomisili", 120);
          const pekerjaan = get("pekerjaan", 160);
          const phone = get("noHpWa", 30);
          const bantuan = get("jenisBantuan", 40);
          const timestamp = get("timestamp", 40) || new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
          const selfPhoto = form.get("fotoDiri");
          const ktpPhoto = form.get("fotoKtp");
          if (!nama || !/^\d{16}$/.test(nik) || !Number.isInteger(usia) || usia < 0 || usia > 120 ||
              !["Laki-laki", "Perempuan"].includes(gender) || !alamat || !kota || !pekerjaan ||
              !/^\+?[0-9 ()-]{8,30}$/.test(phone) || !["BANTUAN NUTRISI", "BANTUAN KEWIRAUSAHAAN"].includes(bantuan)) {
            return reply({ error: "Periksa kembali isian wajib. NIK harus 16 digit dan usia harus 0–120." }, 400);
          }
          const allowedQuestionnaireFiles = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
          const validQuestionnaireFile = (value: FormDataEntryValue | null): value is File =>
            value instanceof File && allowedQuestionnaireFiles.includes(value.type) && value.size > 0 && value.size <= 8 * 1024 * 1024;
          if (!validQuestionnaireFile(selfPhoto) || !validQuestionnaireFile(ktpPhoto)) {
            return reply({ error: "Berkas foto diri dan KTP wajib JPEG, PNG, WebP, PDF, DOC, atau DOCX, maksimal 8 MB per berkas." }, 400);
          }

          const uploadedIds: string[] = [];
          let token = "";
          try {
            token = await googleAccessToken(env);
            const uploadPrivatePhoto = async (photo: File, label: string) => {
              const safeName = (photo.name || label).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || label;
              const metadata = { name: "KuisionerOwner-" + Date.now() + "-" + label + "-" + safeName, mimeType: photo.type };
              const uploadForm = new FormData();
              uploadForm.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }));
              uploadForm.append("file", photo, safeName);
              const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType", {
                method: "POST", headers: { authorization: "Bearer " + token }, body: uploadForm,
              });
              if (!response.ok) {
                let detail = "";
                try { const payload = await response.json() as { error?: { message?: string } }; detail = payload.error?.message || ""; } catch {}
                throw new Error("Google Drive gagal menyimpan " + label + " (HTTP " + response.status + "). " + detail);
              }
              const uploaded = await response.json() as { id?: string; mimeType?: string };
              if (!uploaded.id || uploaded.mimeType !== photo.type) throw new Error("Google Drive tidak mengembalikan identitas file yang valid untuk " + label + ".");
              uploadedIds.push(uploaded.id);
              return "https://drive.google.com/file/d/" + uploaded.id + "/view";
            };

            const selfPhotoUrl = await uploadPrivatePhoto(selfPhoto, "foto-diri");
            const ktpPhotoUrl = await uploadPrivatePhoto(ktpPhoto, "foto-ktp");
            const spreadsheetBase = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID);
            const metadataResponse = await fetch(spreadsheetBase + "?fields=sheets.properties.title,sheets.properties.sheetId", { headers: { authorization: "Bearer " + token } });
            if (!metadataResponse.ok) throw new Error("Tidak dapat membaca metadata Google Sheets (HTTP " + metadataResponse.status + ").");
            let metadata = await metadataResponse.json() as { sheets?: Array<{ properties?: { title?: string; sheetId?: number } }> };
            let ownerTab = (metadata.sheets || []).find(sheet => sheet.properties?.title === "Kuisioner Owner");
            if (!ownerTab) {
              const createResponse = await fetch(spreadsheetBase + ":batchUpdate", {
                method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
                body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "Kuisioner Owner" } } }] }),
              });
              if (!createResponse.ok) {
                let detail = "";
                try { const payload = await createResponse.json() as { error?: { message?: string } }; detail = payload.error?.message || ""; } catch {}
                throw new Error("Gagal membuat tab Kuisioner Owner (HTTP " + createResponse.status + "). " + detail);
              }
              const created = await createResponse.json() as { replies?: Array<{ addSheet?: { properties?: { sheetId?: number; title?: string } } }> };
              ownerTab = { properties: created.replies?.[0]?.addSheet?.properties || { title: "Kuisioner Owner" } };
            }
            const tabName = "'Kuisioner Owner'";
            const headers = ["Timestamp", "NAMA LENGKAP", "NIK", "USIA", "JENIS KELAMIN", "ALAMAT DOMISILI SAAT INI", "KOTA DOMISILI SAAT INI", "PEKERJAAN", "NO HP/WA", "FOTO DIRI", "FOTO KTP", "JENIS BANTUAN"];
            const headerRange = encodeURIComponent(tabName + "!A1:L1");
            const headerCheck = await fetch(spreadsheetBase + "/values/" + headerRange, { headers: { authorization: "Bearer " + token } });
            if (!headerCheck.ok) throw new Error("Gagal memeriksa judul kolom tab Kuisioner Owner (HTTP " + headerCheck.status + ").");
            const headerData = await headerCheck.json() as { values?: string[][] };
            if (!(headerData.values?.[0] || []).some(value => String(value || "").trim())) {
              const writeHeader = await fetch(spreadsheetBase + "/values/" + headerRange + "?valueInputOption=RAW", {
                method: "PUT", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
                body: JSON.stringify({ values: [headers] }),
              });
              if (!writeHeader.ok) throw new Error("Gagal menyiapkan judul kolom tab Kuisioner Owner.");
            }
            const appendRange = encodeURIComponent(tabName + "!A:L");
            const appendResponse = await fetch(spreadsheetBase + "/values/" + appendRange + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", {
              method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
              body: JSON.stringify({ majorDimension: "ROWS", values: [[timestamp, nama, nik, String(usia), gender, alamat, kota, pekerjaan, phone, selfPhotoUrl, ktpPhotoUrl, bantuan]] }),
            });
            if (!appendResponse.ok) {
              let detail = "";
              try { const payload = await appendResponse.json() as { error?: { message?: string } }; detail = payload.error?.message || ""; } catch {}
              throw new Error("Google Sheets gagal menyimpan baris kuesioner (HTTP " + appendResponse.status + "). " + detail);
            }
            await audit(env, admin.id, "owner_questionnaire_submit");
            return reply({ ok: true, message: "Kuesioner tersimpan.", tab: "Kuisioner Owner" });
          } catch (error) {
            if (token) for (const id of uploadedIds) {
              try { await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id), { method: "DELETE", headers: { authorization: "Bearer " + token } }); } catch {}
            }
            const incidentId = logIncident("owner_questionnaire_submit_failed", error, { path: url.pathname, stage: requestStage });
            return reply({ error: (error instanceof Error ? error.message : "Kuesioner gagal disimpan.") + " (ID insiden: " + incidentId + ")" }, 503);
          }
        }

        if (url.pathname === "/api/questionnaires/stage1" && request.method === "GET") {
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login ke dashboard owner." }, 401);
          if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan melihat data kuesioner." }, 403);
          if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            return reply({ error: "Integrasi Google Sheets belum dikonfigurasi." }, 503);
          }
          try {
            const accessToken = await googleAccessToken(env);
            const range = encodeURIComponent("'Kuisioner Owner'!A1:O2000");
            const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(env.GOOGLE_SHEET_ID) + "/values/" + range + "?valueRenderOption=FORMATTED_VALUE", {
              headers: { authorization: "Bearer " + accessToken },
            });
            if (!response.ok) return reply({ error: "Data kuesioner tahap 1 gagal dibaca (HTTP " + response.status + ")." }, 502);
            const payload = await response.json() as { values?: string[][] };
            const rows = payload.values || [];
            if (!rows.length) return reply({ items: [], csrfToken: admin.csrf_token });
            const headers = rows[0].map(value => String(value || "").trim());
            const get = (row: string[], label: string, fallback: number) => {
              const index = headers.findIndex(value => value.toLocaleLowerCase("id-ID") === label.toLocaleLowerCase("id-ID"));
              return String(row[index >= 0 ? index : fallback] || "").trim();
            };
            const fileId = (value: string) => {
              const raw = String(value || "").trim();
              if (/^[A-Za-z0-9_-]{10,200}$/.test(raw)) return raw;
              const match = raw.match(/(?:\/file\/d\/|\/document\/d\/|[?&]id=)([A-Za-z0-9_-]{10,200})/i);
              return match?.[1] || "";
            };
            const items = rows.slice(1).map((row, index) => {
              const name = get(row, "NAMA LENGKAP", 1);
              if (!name) return null;
              return {
                row: index + 2,
                timestamp: get(row, "Timestamp", 0),
                name,
                nik: get(row, "NIK", 2),
                age: get(row, "USIA", 3),
                gender: get(row, "JENIS KELAMIN", 4),
                selfPhotoId: fileId(get(row, "FOTO DIRI", 9)),
                ktpPhotoId: fileId(get(row, "FOTO KTP", 10)),
                address: get(row, "ALAMAT DOMISILI SAAT INI", 5),
                city: get(row, "KOTA DOMISILI SAAT INI", 6),
                assistance: get(row, "JENIS BANTUAN", 11),
                phone: get(row, "NO HP/WA", 8),
              };
            }).filter((item): item is NonNullable<typeof item> => item !== null).reverse();
            return reply({ items, csrfToken: admin.csrf_token });
          } catch (error) {
            const incidentId = logIncident("stage1_questionnaire_load_failed", error, { path: url.pathname });
            return reply({ error: "Data kuesioner tahap 1 gagal dimuat. ID insiden: " + incidentId }, 503);
          }
        }

        if (url.pathname === "/api/assessments" && (request.method === "GET" || request.method === "POST")) {
      if (request.method === "POST" && !isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
      const admin = await sessionAdmin(request, env);
      if (!admin) return reply({ error: "Silakan login." }, 401);
      if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengakses data asesmen." }, 403);
      if (request.method === "POST") {
        const csrf = request.headers.get("X-CSRF-Token");
        if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
      }
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS integrated_assessments (
          id TEXT PRIMARY KEY,
          answers_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL
        )`).run();
        if (request.method === "GET") {
          const rows = await env.DB.prepare("SELECT id,answers_json,created_at,updated_at,created_by FROM integrated_assessments ORDER BY updated_at DESC LIMIT 100").all<{id:string;answers_json:string;created_at:string;updated_at:string;created_by:string}>();
          const items = (rows.results || []).map(row => {
            let respondentName = "";
            try {
              const answers = JSON.parse(row.answers_json) as Record<string, unknown>;
              if (typeof answers.q16 === "string") respondentName = answers.q16.trim().slice(0, 160);
            } catch {}
            return { id: row.id, created_at: row.created_at, updated_at: row.updated_at, created_by: row.created_by, respondent_name: respondentName };
          });
          return reply({ items });
        }
        let body: { id?: unknown; answers?: unknown };
        try { body = await request.json() as typeof body; } catch { return reply({ error: "Format data asesmen tidak valid." }, 400); }
        const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : crypto.randomUUID();
        if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return reply({ error: "Jawaban asesmen tidak valid." }, 400);
        const answersJson = JSON.stringify(body.answers);
        if (answersJson.length > 1500000) return reply({ error: "Data asesmen terlalu besar (maksimal 1,5 MB termasuk foto yang telah dikompresi)." }, 413);
        await env.DB.prepare(`INSERT INTO integrated_assessments(id,answers_json,created_by,updated_by)
          VALUES(?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET answers_json=excluded.answers_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`)
          .bind(id, answersJson, admin.username, admin.username).run();
        try {
          await audit(env, String((admin as Record<string,string>).id || admin.username), "assessment_saved");
        } catch {
          console.warn("assessment_audit_failed", { stage: "audit" });
        }
        return reply({ ok: true, id });
      } catch (error) {
        const incidentId = logIncident("assessment_database_error", error, { path: url.pathname });
        return reply({ error: "Database asesmen gagal memproses permintaan. ID insiden: " + incidentId }, 500);
      }
    }

    if (url.pathname === "/api/assessments/item" && (request.method === "GET" || request.method === "DELETE")) {
      if (request.method === "DELETE" && !isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
      const admin = await sessionAdmin(request, env);
      if (!admin) return reply({ error: "Silakan login." }, 401);
      if (admin.role !== "owner" && admin.role !== "admin") return reply({ error: "Peran tidak diizinkan mengakses data asesmen." }, 403);
      if (request.method === "DELETE") {
        const csrf = request.headers.get("X-CSRF-Token");
        if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
      }
      const id = url.searchParams.get("id") || "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "ID asesmen tidak valid." }, 400);
      try {
        if (request.method === "DELETE") {
          const existing = await env.DB.prepare("SELECT id FROM integrated_assessments WHERE id=?")
            .bind(id).first<{ id: string }>();
          if (!existing) return reply({ error: "Data asesmen tidak ditemukan." }, 404);
          await env.DB.prepare("DELETE FROM integrated_assessments WHERE id=?").bind(id).run();
          try {
            await env.DB.prepare("INSERT INTO audit_log(admin_id,action,target_type,target_id) VALUES(?,?,?,?)")
              .bind(admin.id, "assessment_deleted", "integrated_assessment", id).run();
          } catch {
            console.warn("assessment_delete_audit_failed", { stage: "audit" });
          }
          return reply({ ok: true, id });
        }
        const row = await env.DB.prepare("SELECT id,answers_json,created_at,updated_at FROM integrated_assessments WHERE id=?")
          .bind(id).first<{ id: string; answers_json: string; created_at: string; updated_at: string }>();
        if (!row) return reply({ error: "Data asesmen tidak ditemukan." }, 404);
        return reply({ item: { id: row.id, answers: JSON.parse(row.answers_json), created_at: row.created_at, updated_at: row.updated_at } });
      } catch (error) {
        const incidentId = logIncident(request.method === "DELETE" ? "assessment_delete_error" : "assessment_load_error", error, { path: url.pathname });
        return reply({ error: (request.method === "DELETE" ? "Data asesmen gagal dihapus." : "Data asesmen gagal dimuat.") + " ID insiden: " + incidentId }, 500);
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
            const range = "'" + tab.replace(/'/g, "''") + "'!A1:ZZ1000";
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
            const items = await Promise.all(values.slice(1).map(async (row, index) => {
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
              return row.some((v) => String(v || "").trim()) ? record : null;
            })).then(records => records.filter((record): record is Record<string, string> => record !== null));
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
          return reply({ ok: true, enabled: !!(env.VAPID_PUBLIC_KEY && env.VAPID_SUBJECT), publicKey: env.VAPID_PUBLIC_KEY && env.VAPID_SUBJECT ? env.VAPID_PUBLIC_KEY : "" });
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
          // Keep the owner account label synchronized with the profile name shown on the dashboard.
          await env.DB.prepare("UPDATE admins SET display_name=? WHERE id=? AND role='owner' AND active=1")
            .bind(employeeName, admin.id).run();
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
          if (!env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) return reply({ error: "Konfigurasi kunci publik push belum lengkap di Cloudflare." }, 503);
          await ensureFeatureSchema(env);
          const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first<{ n: number }>();
          if (!count?.n) return reply({ error: "Belum ada perangkat yang berlangganan notifikasi. Aktifkan notifikasi HP terlebih dahulu." }, 409);
          await env.DB.prepare("INSERT INTO dashboard_notifications(title,body,action) VALUES(?,?,?)")
            .bind("Tes notifikasi Sahabat ODHIV Sumut", "Tes notifikasi dijadwalkan. Periksa banner dan layar kunci perangkat.", "push_test").run();
          await env.DB.prepare("INSERT INTO notification_state(state_key,state_value) VALUES('pending_push_test',?) ON CONFLICT(state_key) DO UPDATE SET state_value=excluded.state_value,updated_at=CURRENT_TIMESTAMP")
            .bind(new Date().toISOString()).run();
          return reply({ ok: true, message: "Tes notifikasi masuk antrean pengiriman. Worker pengirim akan memprosesnya pada siklus berikutnya." });
        }

        if (url.pathname === "/api/push-subscriptions" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner") return reply({ error: "Hanya owner yang dapat mengaktifkan notifikasi perangkat." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (!env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) return reply({ error: "Kunci publik push belum dikonfigurasi di Cloudflare." }, 503);
          await ensureFeatureSchema(env);
          let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
          try { body = await request.json() as typeof body; } catch { return reply({ error: "Format langganan notifikasi tidak valid." }, 400); }
          const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
          const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
          const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
          let endpointUrl: URL;
          try { endpointUrl = new URL(endpoint); } catch { return reply({ error: "Alamat push tidak valid." }, 400); }
          if (!isAllowedPushEndpoint(endpoint) || endpoint.length > 2048 || p256dh.length > 256 || auth.length > 128 || !/^[A-Za-z0-9_-]+$/.test(p256dh) || !/^[A-Za-z0-9_-]+$/.test(auth)) return reply({ error: "Data langganan push tidak valid." }, 400);
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


        if (url.pathname === "/api/drive/setup-folders" && request.method === "POST") {
          if (!isAllowedOrigin(request, env)) return reply({ error: "Origin tidak diizinkan." }, 403);
          const admin = await sessionAdmin(request, env);
          if (!admin) return reply({ error: "Silakan login." }, 401);
          if (admin.role !== "owner") return reply({ error: "Hanya owner yang dapat menyiapkan folder Drive." }, 403);
          const csrf = request.headers.get("X-CSRF-Token");
          if (!csrf || csrf !== admin.csrf_token) return reply({ error: "Token CSRF tidak valid." }, 403);
          if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            return reply({ error: "Integrasi Google Drive belum dikonfigurasi." }, 503);
          }
          try {
            requestStage = "drive_folder_schema";
            await ensureDriveIntegrationSchema(env);
            requestStage = "drive_folder_auth";
            const token = await googleAccessToken(env);
            requestStage = "drive_folder_create";
            const root = await getOrCreateDriveFolder(token, "Sahabat ODHIV Sumatera Utara");
            const documents = await getOrCreateDriveFolder(token, "Dokumen Aplikasi", root.id);
            const backups = await getOrCreateDriveFolder(token, "Cadangan Proyek", root.id);
            await env.DB.batch([
              env.DB.prepare("INSERT INTO integration_settings(setting_key,setting_value,updated_at) VALUES('drive_folder_root',?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP").bind(root.id),
              env.DB.prepare("INSERT INTO integration_settings(setting_key,setting_value,updated_at) VALUES('drive_folder_documents',?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP").bind(documents.id),
              env.DB.prepare("INSERT INTO integration_settings(setting_key,setting_value,updated_at) VALUES('drive_folder_backups',?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP").bind(backups.id),
            ]);
            await audit(env, admin.id, "drive_folder_setup");
            return reply({
              ok: true,
              message: "Struktur folder Google Drive siap digunakan.",
              folders: [
                { name: root.name, url: root.webViewLink || "https://drive.google.com/drive/my-drive" },
                { name: documents.name, url: documents.webViewLink || "https://drive.google.com/drive/my-drive" },
                { name: backups.name, url: backups.webViewLink || "https://drive.google.com/drive/my-drive" },
              ],
              githubBackup: { ready: false, requiredSecrets: ["DRIVE_BACKUP_TOKEN di Cloudflare Worker", "DRIVE_BACKUP_TOKEN di GitHub Actions Secrets"] },
            });
          } catch (error) {
            const incidentId = logIncident("drive_folder_setup_failed", error, { path: url.pathname, stage: requestStage, providerStatus: safeProviderHttpStatus(error) });
            return reply({ error: "Penyiapan folder Google Drive gagal. ID insiden: " + incidentId }, 503);
          }
        }

        if (url.pathname === "/api/drive/backup/status" && request.method === "GET") {
          if (!env.DRIVE_BACKUP_TOKEN) return reply({ ok: false, error: "Endpoint cadangan belum diaktifkan.", code: "DRIVE_BACKUP_DISABLED" }, 503);
          const authorization = request.headers.get("Authorization") || "";
          const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
          if (!suppliedToken || suppliedToken.length > 512) return reply({ ok: false, error: "Akses tidak diizinkan." }, 401);
          const expectedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.DRIVE_BACKUP_TOKEN));
          const suppliedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(suppliedToken));
          const expectedBytes = new Uint8Array(expectedHash);
          const suppliedBytes = new Uint8Array(suppliedHash);
          let tokenMatches = expectedBytes.length === suppliedBytes.length;
          for (let i = 0; i < expectedBytes.length; i++) tokenMatches = (expectedBytes[i] === suppliedBytes[i]) && tokenMatches;
          if (!tokenMatches) return reply({ ok: false, error: "Akses tidak diizinkan." }, 401);
          const folderId = env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || "";
          if (!/^[A-Za-z0-9_-]{10,200}$/.test(folderId)) {
            return reply({ ok: false, error: "GOOGLE_DRIVE_BACKUP_FOLDER_ID belum diatur ke ID folder di Shared Drive.", code: "DRIVE_BACKUP_FOLDER_MISSING" }, 409);
          }
          if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            return reply({ ok: false, error: "Kredensial Google Drive belum lengkap di Cloudflare Worker.", code: "GOOGLE_DRIVE_CREDENTIALS_MISSING" }, 503);
          }
          try {
            requestStage = "drive_backup_preflight_auth";
            const token = await googleAccessToken(env);
            requestStage = "drive_backup_preflight_folder";
            const folderResponse = await fetch(
              "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(folderId) +
              "?fields=id,name,mimeType,driveId,trashed,capabilities(canAddChildren)&supportsAllDrives=true",
              { headers: { authorization: "Bearer " + token } }
            );
            if (!folderResponse.ok) {
              const incidentId = logIncident(
                "drive_backup_preflight_folder_failed",
                new Error("Google Drive folder metadata request failed (HTTP " + folderResponse.status + ")."),
                { path: url.pathname, stage: requestStage, providerStatus: folderResponse.status }
              );
              return reply({
                ok: false,
                error: "Google Drive tidak dapat memverifikasi folder tujuan (HTTP " + folderResponse.status + "). Periksa ID folder dan keanggotaan service account.",
                code: "DRIVE_BACKUP_FOLDER_UNAVAILABLE",
                incidentId,
              }, 502);
            }
            const folder = await folderResponse.json() as {
              name?: string;
              mimeType?: string;
              driveId?: string;
              trashed?: boolean;
              capabilities?: { canAddChildren?: boolean };
            };
            if (folder.mimeType !== "application/vnd.google-apps.folder" || !folder.driveId || folder.trashed || folder.capabilities?.canAddChildren !== true) {
              return reply({
                ok: false,
                error: "Tujuan harus berupa folder aktif di Google Shared Drive dan service account harus memiliki izin menambahkan file (Contributor atau lebih tinggi).",
                code: "DRIVE_BACKUP_FOLDER_NOT_WRITABLE",
              }, 409);
            }
            return reply({ ok: true, folderName: folder.name || "Cadangan Proyek", sharedDrive: true, canUpload: true });
          } catch (error) {
            const incidentId = logIncident("drive_backup_preflight_failed", error, { path: url.pathname, stage: requestStage, providerStatus: safeProviderHttpStatus(error) });
            return reply({ ok: false, error: "Pemeriksaan tujuan cadangan gagal. ID insiden: " + incidentId, code: "DRIVE_BACKUP_PREFLIGHT_FAILED", incidentId }, 503);
          }
        }

        if (url.pathname === "/api/drive/backup" && request.method === "POST") {
          if (!env.DRIVE_BACKUP_TOKEN) return reply({ error: "Endpoint cadangan belum diaktifkan." }, 503);
          const authorization = request.headers.get("Authorization") || "";
          const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
          if (!suppliedToken || suppliedToken.length > 512) return reply({ error: "Akses tidak diizinkan." }, 401);
          const expectedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.DRIVE_BACKUP_TOKEN));
          const suppliedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(suppliedToken));
          const expectedBytes = new Uint8Array(expectedHash);
          const suppliedBytes = new Uint8Array(suppliedHash);
          let tokenMatches = expectedBytes.length === suppliedBytes.length;
          for (let i = 0; i < expectedBytes.length; i++) tokenMatches = (expectedBytes[i] === suppliedBytes[i]) && tokenMatches;
          if (!tokenMatches) return reply({ error: "Akses tidak diizinkan." }, 401);
          const contentType = request.headers.get("Content-Type") || "";
          const contentLength = Number(request.headers.get("Content-Length") || "0");
          if (!/^application\/(?:gzip|x-gzip|octet-stream)$/.test(contentType.split(";")[0].trim()) || !Number.isFinite(contentLength) || contentLength < 1 || contentLength > 20 * 1024 * 1024) {
            return reply({ error: "Arsip harus berupa gzip dan berukuran maksimal 20 MB." }, 413);
          }
          try {
            requestStage = "drive_backup_schema";
            await ensureDriveIntegrationSchema(env);
            // Prefer a folder inside a Shared Drive. Service accounts have no personal Drive quota.
            const folderId = env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
            if (!folderId || !/^[A-Za-z0-9_-]{10,200}$/.test(folderId)) return reply({ error: "Folder Shared Drive cadangan belum dikonfigurasi. Atur GOOGLE_DRIVE_BACKUP_FOLDER_ID ke ID folder tujuan pada Shared Drive." }, 409);
            if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) return reply({ error: "Integrasi Google Drive belum dikonfigurasi." }, 503);
            const bytes = await request.arrayBuffer();
            if (bytes.byteLength < 1 || bytes.byteLength > 20 * 1024 * 1024) return reply({ error: "Arsip tidak valid atau melebihi 20 MB." }, 413);
            requestStage = "drive_backup_auth";
            const token = await googleAccessToken(env);
            requestStage = "drive_backup_validate_folder";
            const folderResponse = await fetch(
              "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(folderId) +
              "?fields=id,mimeType,driveId,trashed,capabilities(canAddChildren)&supportsAllDrives=true",
              { headers: { authorization: "Bearer " + token } }
            );
            if (!folderResponse.ok) throw new Error("Google Drive backup folder check failed (HTTP " + folderResponse.status + ").");
            const folder = await folderResponse.json() as {
              mimeType?: string;
              driveId?: string;
              trashed?: boolean;
              capabilities?: { canAddChildren?: boolean };
            };
            if (folder.mimeType !== "application/vnd.google-apps.folder" || !folder.driveId || folder.trashed || folder.capabilities?.canAddChildren !== true) {
              throw new Error("Backup destination is not an active writable Shared Drive folder.");
            }
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const metadata = { name: "sahabatodhiv-sumut-source-" + stamp + ".tar.gz", mimeType: "application/gzip", parents: [folderId] };
            const form = new FormData();
            form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }));
            form.append("file", new Blob([bytes], { type: "application/gzip" }), metadata.name);
            requestStage = "drive_backup_upload";
            const upload = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink", {
              method: "POST", headers: { authorization: "Bearer " + token }, body: form,
            });
            if (!upload.ok) {
              let providerReason = "";
              try {
                const failure = await upload.json() as { error?: { errors?: Array<{ reason?: string }>; status?: string } };
                providerReason = failure.error?.errors?.find((item) => typeof item.reason === "string")?.reason || failure.error?.status || "";
              } catch { /* Jangan log isi mentah respons provider. */ }
              const safeReason = /^[a-zA-Z0-9_.:-]{1,80}$/.test(providerReason) ? providerReason : "";
              throw new Error("Google Drive backup upload failed (HTTP " + upload.status + (safeReason ? ", reason=" + safeReason : "") + ").");
            }
            const saved = await upload.json() as { id?: string; name?: string; webViewLink?: string };
            if (!saved.id) throw new Error("Google Drive backup upload returned no ID.");
            return reply({ ok: true, fileName: saved.name || metadata.name, fileUrl: saved.webViewLink || null });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "";
            const reasonMatch = errorMessage.match(/reason=([a-zA-Z0-9_.:-]{1,80})/);
            const incidentId = logIncident("drive_backup_upload_failed", error, { path: url.pathname, stage: requestStage, providerStatus: safeProviderHttpStatus(error), providerReason: reasonMatch?.[1] });
            return reply({ error: "Cadangan proyek gagal diunggah. ID insiden: " + incidentId }, 503);
          }
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
    assetHeaders.set("cross-origin-resource-policy", "same-origin");
    assetHeaders.set("x-permitted-cross-domain-policies", "none");
    assetHeaders.set("permissions-policy", "camera=(self), microphone=(), geolocation=()");
    assetHeaders.set("content-security-policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://upload.wikimedia.org https://commons.wikimedia.org https://sumutprov.go.id https://api.qrserver.com; connect-src 'self' https://raw.githubusercontent.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://docs.google.com");
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
