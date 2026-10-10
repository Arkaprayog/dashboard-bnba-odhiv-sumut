PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','staff')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key_b64url TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports_json TEXT NOT NULL DEFAULT '[]',
  device_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES admins(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register','login')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  user_agent_hash TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Store only workflow metadata here; identity/health details remain in the
-- restricted source spreadsheet. respondent_key must be a stable opaque key,
-- not an NIK or phone number.
CREATE TABLE IF NOT EXISTS respondent_workflow (
  respondent_key TEXT PRIMARY KEY,
  report_status TEXT NOT NULL DEFAULT 'Belum Dilaporkan'
    CHECK (report_status IN ('Sudah Dilaporkan','Belum Dilaporkan','Proses Verifikasi')),
  desil INTEGER CHECK (desil BETWEEN 1 AND 10 OR desil = 0),
  template_choice TEXT CHECK (template_choice IN ('Template 1','Template 2')),
  updated_by TEXT REFERENCES admins(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passkeys_admin ON passkeys(admin_id);
CREATE INDEX IF NOT EXISTS idx_challenges_expiry ON auth_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON respondent_workflow(report_status);
