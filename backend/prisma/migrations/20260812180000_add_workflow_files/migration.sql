-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow_files" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,
    "action_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflow_files_workflow_id_idx" ON "workflow_files"("workflow_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflow_files_file_id_idx" ON "workflow_files"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_files_workflow_id_file_id_key" ON "workflow_files"("workflow_id", "file_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "workflow_files"
    ADD CONSTRAINT "workflow_files_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_files"
    ADD CONSTRAINT "workflow_files_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_files"
    ADD CONSTRAINT "workflow_files_added_by_fkey"
    FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_files"
    ADD CONSTRAINT "workflow_files_action_id_fkey"
    FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
