-- MINUR UPDATE push notifications.
-- Run against the production D1 database only after reviewing the release plan.
-- FCM tokens are secrets: never expose them through public APIs or logs.
CREATE TABLE IF NOT EXISTS fcm_device_tokens (
  token_hash TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web','android')),
  installation_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_enabled_platform
  ON fcm_device_tokens(enabled, platform);

-- Idempotency ledger prevents a retried Google Forms trigger or internal
-- questionnaire submission from notifying the same event more than once.
CREATE TABLE IF NOT EXISTS notification_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('google_forms','internal_stage1')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed'))
);
CREATE INDEX IF NOT EXISTS idx_notification_events_created
  ON notification_events(created_at);
