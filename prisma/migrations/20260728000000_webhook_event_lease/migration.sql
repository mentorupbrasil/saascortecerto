-- AlterTable
ALTER TABLE "ProcessedWebhookEvent" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProcessedWebhookEvent" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProcessedWebhookEvent" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- processedAt was NOT NULL with default; make nullable for in-flight events
ALTER TABLE "ProcessedWebhookEvent" ALTER COLUMN "processedAt" DROP NOT NULL;
ALTER TABLE "ProcessedWebhookEvent" ALTER COLUMN "processedAt" DROP DEFAULT;

-- Backfill: treat existing rows without lockedAt (already defaulted) and clear processedAt for PROCESSING
UPDATE "ProcessedWebhookEvent"
SET "processedAt" = NULL
WHERE "status" = 'PROCESSING';

CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_status_lockedAt_idx"
  ON "ProcessedWebhookEvent"("status", "lockedAt");
