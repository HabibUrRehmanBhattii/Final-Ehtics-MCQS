CREATE TABLE IF NOT EXISTS admin_progress_reset_actions (
  id TEXT PRIMARY KEY,
  actor_admin_user_id TEXT,
  target_user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  topic_id TEXT,
  test_id TEXT,
  before_payload TEXT NOT NULL,
  after_payload TEXT NOT NULL,
  removed_keys_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  undone_at TEXT,
  undone_by_user_id TEXT,
  FOREIGN KEY (actor_admin_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (undone_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_progress_reset_target_expiry
  ON admin_progress_reset_actions(target_user_id, undone_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_progress_reset_expires
  ON admin_progress_reset_actions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_progress_reset_actor_time
  ON admin_progress_reset_actions(actor_admin_user_id, created_at);

PRAGMA optimize;
