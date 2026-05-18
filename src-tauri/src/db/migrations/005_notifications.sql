CREATE TABLE IF NOT EXISTS notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT    NOT NULL,
  key         TEXT    NOT NULL,
  sent_at     TEXT    NOT NULL,
  UNIQUE(kind, key)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_sent
  ON notification_log(sent_at DESC);

CREATE TABLE IF NOT EXISTS notification_prefs (
  kind        TEXT    PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 1,
  config_json TEXT    NOT NULL DEFAULT '{}'
);
