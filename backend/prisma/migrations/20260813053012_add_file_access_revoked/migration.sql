-- AlterTable
ALTER TABLE "files" ADD COLUMN     "access_revoked_at" TIMESTAMP(3),
ADD COLUMN     "access_revoked_by" TEXT;
