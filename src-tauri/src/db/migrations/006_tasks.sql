CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  exam_id     INTEGER NULL REFERENCES exams(id) ON DELETE SET NULL,
  priority    TEXT    NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  due_date    TEXT    NULL,
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tasks_exam      ON tasks(exam_id);
CREATE INDEX idx_tasks_due       ON tasks(due_date);
CREATE INDEX idx_tasks_done_prio ON tasks(done, priority);

CREATE TABLE task_links (
  predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (predecessor_id, successor_id),
  CHECK (predecessor_id != successor_id)
);

CREATE INDEX idx_links_succ ON task_links(successor_id);

CREATE TABLE task_checklist (
  id        INTEGER PRIMARY KEY,
  task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label     TEXT    NOT NULL,
  done      INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  position  INTEGER NOT NULL
);

CREATE INDEX idx_checklist_task ON task_checklist(task_id, position);
