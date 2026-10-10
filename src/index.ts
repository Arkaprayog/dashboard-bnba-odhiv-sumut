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
  OWNER_BOOTSTRAP_TOKEN?: string;
}
const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
function reply(data: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...NO_STORE, "content-type":"application/json; charset=utf-8", ...extra } });
}
function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("Cookie") || "";
  for (const item of raw.split(";")) {
    const i = item.indexOf("=");
    if (i > 0 && item.slice(0,i).trim() === name) return item.slice(i+1).trim();
  }
  return null;
}
function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function unhex(s: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(s)) return new Uint8Array();
  const out = new Uint8Array(s.length/2);
  for (let i=0;i<out.length;i++) out[i]=parseInt(s.slice(i*2,i*2+2),16);
  return out;
}
async function digestHex(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
async function passwordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},key,256));
}
async function sessionAdmin(request: Request, env: Env) {
  const raw = cookieValue(request, "ppks_session");
  if (!raw || raw.length > 200) return null;
  const hash = await digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  const now = Math.floor(Date.now()/1000);
  return env.DB.prepare(`SELECT a.id,a.username,a.display_name,a.role,s.csrf_token
    FROM sessions s JOIN admins a ON a.id=s.admin_id
    WHERE s.id_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.active=1`).bind(hash,now).first<Record<string,string>>();
}
async function audit(env: Env, adminId: string, action: string) {
  await env.DB.prepare("INSERT INTO audit_log(admin_id,action) VALUES(?,?)").bind(adminId,action).run();
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return reply({ok:true,service:"dashboard-bnba-odhiv-sumut",mode:"auth-bootstrap"});
    }
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB) return reply({error:"Database D1 belum dikonfigurasi."},503);
      if (url.pathname === "/api/setup-owner" && request.method === "POST") {
        if (request.headers.get("Origin") !== env.APP_ORIGIN) return reply({error:"Origin tidak diizinkan."},403);
        if (!env.OWNER_BOOTSTRAP_TOKEN || env.OWNER_BOOTSTRAP_TOKEN.length < 32) return reply({error:"Setup owner belum diaktifkan oleh administrator sistem."},503);
        const supplied = request.headers.get("X-Owner-Bootstrap-Token") || "";
        const a = new TextEncoder().encode(supplied), b = new TextEncoder().encode(env.OWNER_BOOTSTRAP_TOKEN);
        let diff = a.length ^ b.length; for (let i=0;i<Math.max(a.length,b.length);i++) diff |= (a[i]||0) ^ (b[i]||0);
        if (diff !== 0) return reply({error:"Token setup tidak valid."},403);
        const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins").first<{n:number}>();
        if (!count || count.n !== 0) return reply({error:"Setup awal sudah ditutup karena akun admin sudah ada."},409);
        let body:{username?:string;displayName?:string;password?:string};
        try { body = await request.json() as typeof body; } catch { return reply({error:"Format permintaan tidak valid."},400); }
        const username = typeof body.username==="string" ? body.username.trim().toLowerCase() : "";
        const displayName = typeof body.displayName==="string" ? body.displayName.trim() : "";
        const password = typeof body.password==="string" ? body.password : "";
        if (!/^[a-z0-9._-]{3,64}$/.test(username) || displayName.length<2 || displayName.length>100 || password.length<14 || password.length>1024) return reply({error:"Gunakan username 3–64 karakter, nama 2–100 karakter, dan kata sandi minimal 14 karakter."},400);
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await passwordHash(password,salt);
        const hex=(v:Uint8Array)=>[...v].map(n=>n.toString(16).padStart(2,"0")).join("");
        const id = crypto.randomUUID();
        try {
          await env.DB.prepare("INSERT INTO admins(id,username,display_name,password_hash,password_salt,role,active) VALUES(?,?,?,?,?,'owner',1)").bind(id,username,displayName,hex(hash),hex(salt)).run();
          await audit(env,id,"owner_bootstrap");
        } catch { return reply({error:"Akun tidak dapat dibuat. Pastikan migrasi database sudah dijalankan."},503); }
        return reply({ok:true,message:"Akun owner berhasil dibuat. Hapus secret OWNER_BOOTSTRAP_TOKEN dari konfigurasi Worker sekarang."},201);
      }
      if (url.pathname === "/api/login" && request.method === "POST") {
        if (request.headers.get("Origin") !== env.APP_ORIGIN) return reply({error:"Origin tidak diizinkan."},403);
        let body: {username?:string;password?:string};
        try { body = await request.json() as typeof body; } catch { return reply({error:"Format permintaan tidak valid."},400); }
        const username = typeof body.username==="string" ? body.username.trim().toLowerCase() : "";
        const password = typeof body.password==="string" ? body.password : "";
        if (!/^[a-z0-9._-]{3,64}$/.test(username) || password.length<1 || password.length>1024) return reply({error:"Nama pengguna atau kata sandi salah."},401);
        const admin = await env.DB.prepare("SELECT id,username,display_name,password_hash,password_salt,role,active FROM admins WHERE username=? LIMIT 1").bind(username).first<AdminRow>();
        if (!admin || admin.active!==1) return reply({error:"Nama pengguna atau kata sandi salah."},401);
        const salt=unhex(admin.password_salt);
        if (salt.length<16) return reply({error:"Akun belum disiapkan dengan format aman."},503);
        const actual=await passwordHash(password,salt);
        const expected=unhex(admin.password_hash);
        let diff = actual.length ^ expected.length;
        for (let i=0; i<Math.max(actual.length,expected.length); i++) diff |= (actual[i]||0) ^ (expected[i]||0);
        if (diff !== 0) return reply({error:"Nama pengguna atau kata sandi salah."},401);
        const raw=b64(crypto.getRandomValues(new Uint8Array(32)));
        const csrf=b64(crypto.getRandomValues(new Uint8Array(24)));
        const idHash=await digestHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
        const now=Math.floor(Date.now()/1000);
        const ttl=Math.max(900,Math.min(28800,Number(env.SESSION_TTL_SECONDS)||28800));
        await env.DB.prepare("INSERT INTO sessions(id_hash,admin_id,csrf_token,created_at,expires_at) VALUES(?,?,?,?,?)").bind(idHash,admin.id,csrf,now,now+ttl).run();
        await env.DB.prepare("UPDATE admins SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").bind(admin.id).run();
        await audit(env,admin.id,"login_success");
        return reply({ok:true,admin:{username:admin.username,display_name:admin.display_name,role:admin.role},csrfToken:csrf},200,{
          "set-cookie":`ppks_session=${raw}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`
        });
      }
      if (url.pathname === "/api/me" && request.method === "GET") {
        const admin=await sessionAdmin(request,env);
        if(!admin) return reply({error:"Silakan login."},401);
        return reply({admin:{username:admin.username,display_name:admin.display_name,role:admin.role},csrfToken:admin.csrf_token});
      }
      if (url.pathname === "/api/logout" && request.method === "POST") {
        if (request.headers.get("Origin") !== env.APP_ORIGIN) return reply({error:"Origin tidak diizinkan."},403);
        const admin=await sessionAdmin(request,env);
        if(!admin) return reply({ok:true},200,{"set-cookie":"ppks_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
        const csrf=request.headers.get("X-CSRF-Token");
        if(!csrf || csrf!==admin.csrf_token) return reply({error:"Token CSRF tidak valid."},403);
        const raw=cookieValue(request,"ppks_session")!;
        const hash=await digestHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
        await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE id_hash=?").bind(Math.floor(Date.now()/1000),hash).run();
        await audit(env,admin.id,"logout");
        return reply({ok:true},200,{"set-cookie":"ppks_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
      }
      // Respondent APIs stay closed until Google Sheets/Drive authorization,
      // workflow writes, rate limiting and access policies are reviewed.
      return reply({error:"Endpoint data belum diaktifkan. Login tidak membuka akses data sampai integrasi selesai."},503);
    }
    return env.ASSETS.fetch(request);
  }
};
