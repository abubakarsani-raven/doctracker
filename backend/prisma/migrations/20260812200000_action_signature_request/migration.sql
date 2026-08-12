-- Link workflow actions to signature requests (type = signature)
ALTER TABLE "actions" ADD COLUMN "signature_request_id" TEXT;

CREATE UNIQUE INDEX "actions_signature_request_id_key" ON "actions"("signature_request_id");

ALTER TABLE "actions" ADD CONSTRAINT "actions_signature_request_id_fkey" FOREIGN KEY ("signature_request_id") REFERENCES "signature_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
