CREATE INDEX IF NOT EXISTS "idx_admin_audit_created"
  ON "admin_audit_log" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_admin_audit_actor"
  ON "admin_audit_log" ("actor_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_admin_audit_action"
  ON "admin_audit_log" ("action", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_admin_audit_target"
  ON "admin_audit_log" ("target_type", "created_at" DESC);
