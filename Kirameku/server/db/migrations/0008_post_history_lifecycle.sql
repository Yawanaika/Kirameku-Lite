-- Versioned working drafts are separate from live article content.
ALTER TABLE "post" ADD COLUMN "scheduled_at" INTEGER;

CREATE TABLE "post_revision" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "post_id" INTEGER NOT NULL REFERENCES "post"("id") ON DELETE CASCADE,
  "snapshot" TEXT NOT NULL,
  "created_at" INTEGER
);
CREATE INDEX "idx_post_revision_post_created"
  ON "post_revision" ("post_id", "created_at");

CREATE TABLE "post_draft" (
  "post_id" INTEGER PRIMARY KEY NOT NULL REFERENCES "post"("id") ON DELETE CASCADE,
  "snapshot" TEXT NOT NULL,
  "updated_at" INTEGER
);
