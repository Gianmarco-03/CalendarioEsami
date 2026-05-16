CREATE TABLE exams (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('esame','progetto')),
  passed      INTEGER NOT NULL DEFAULT 0 CHECK (passed IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE appelli (
  id       INTEGER PRIMARY KEY,
  exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  UNIQUE (exam_id, date)
);
CREATE INDEX idx_appelli_date ON appelli(date);

CREATE TABLE project_ranges (
  id          INTEGER PRIMARY KEY,
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  start_date  TEXT    NOT NULL,
  end_date    TEXT    NOT NULL,
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_ranges ON project_ranges(start_date, end_date);

CREATE TABLE study_days (
  exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  PRIMARY KEY (exam_id, date)
);
CREATE INDEX idx_study_date ON study_days(date);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
