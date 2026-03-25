CREATE TABLE IF NOT EXISTS heatmap_sessions (
  id TEXT PRIMARY KEY,
  site_session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_id TEXT,
  is_authenticated INTEGER NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'unknown',
  user_agent TEXT,
  ip_address TEXT,
  route_path TEXT,
  topic_id TEXT,
  test_id TEXT,
  quiz_key TEXT,
  viewport_width INTEGER NOT NULL DEFAULT 0,
  viewport_height INTEGER NOT NULL DEFAULT 0,
  timezone_offset INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_event_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_heatmap_sessions_site_session ON heatmap_sessions(site_session_id);
CREATE INDEX IF NOT EXISTS idx_heatmap_sessions_visitor_time ON heatmap_sessions(visitor_id, last_event_at);
CREATE INDEX IF NOT EXISTS idx_heatmap_sessions_user_time ON heatmap_sessions(user_id, last_event_at);
CREATE INDEX IF NOT EXISTS idx_heatmap_sessions_scope_time ON heatmap_sessions(topic_id, test_id, last_event_at);

CREATE TABLE IF NOT EXISTS heatmap_events (
  id TEXT PRIMARY KEY,
  heatmap_session_id TEXT NOT NULL,
  user_id TEXT,
  visitor_id TEXT NOT NULL,
  is_authenticated INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  route_path TEXT,
  topic_id TEXT,
  test_id TEXT,
  question_id TEXT,
  option_index INTEGER,
  x_percent REAL,
  y_percent REAL,
  scroll_percent REAL,
  element_selector TEXT,
  metadata_json TEXT,
  device_type TEXT NOT NULL DEFAULT 'unknown',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (heatmap_session_id) REFERENCES heatmap_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_heatmap_events_time ON heatmap_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_heatmap_events_session_time ON heatmap_events(heatmap_session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_heatmap_events_question_time ON heatmap_events(question_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_heatmap_events_scope_time ON heatmap_events(topic_id, test_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_heatmap_events_audience_device ON heatmap_events(is_authenticated, device_type, occurred_at);

CREATE TABLE IF NOT EXISTS heatmap_replay_chunks (
  id TEXT PRIMARY KEY,
  heatmap_session_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_json TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  occurred_from TEXT,
  occurred_to TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (heatmap_session_id) REFERENCES heatmap_sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_heatmap_replay_session_chunk ON heatmap_replay_chunks(heatmap_session_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_heatmap_replay_created_at ON heatmap_replay_chunks(created_at);

CREATE TABLE IF NOT EXISTS heatmap_daily_aggregates (
  day_key TEXT NOT NULL,
  question_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  device_type TEXT NOT NULL,
  audience_scope TEXT NOT NULL,
  event_type TEXT NOT NULL,
  option_index INTEGER NOT NULL DEFAULT -1,
  click_count INTEGER NOT NULL DEFAULT 0,
  move_count INTEGER NOT NULL DEFAULT 0,
  scroll_count INTEGER NOT NULL DEFAULT 0,
  hover_count INTEGER NOT NULL DEFAULT 0,
  sum_scroll_percent REAL NOT NULL DEFAULT 0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day_key, question_id, topic_id, test_id, device_type, audience_scope, event_type, option_index)
);

CREATE INDEX IF NOT EXISTS idx_heatmap_daily_question_time ON heatmap_daily_aggregates(question_id, day_key);
CREATE INDEX IF NOT EXISTS idx_heatmap_daily_scope_time ON heatmap_daily_aggregates(topic_id, test_id, day_key);

PRAGMA optimize;
