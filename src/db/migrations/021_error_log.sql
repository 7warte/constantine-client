CREATE TABLE error_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method       VARCHAR(10),
  path         VARCHAR(500),
  status_code  INTEGER,
  message      TEXT,
  stack        TEXT,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_error_log_created_at ON error_log(created_at DESC);
CREATE INDEX idx_error_log_status_code ON error_log(status_code);
