-- CreateEnum
CREATE TYPE "CommissionEntryKind" AS ENUM ('EARNED', 'REVERSAL');

-- AlterTable: Sale.defaultBarberId
ALTER TABLE "Sale" ADD COLUMN     "defaultBarberId" TEXT;

-- CreateTable: SalePaymentBatch
CREATE TABLE "SalePaymentBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePaymentBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable: SalePayment.batchId
ALTER TABLE "SalePayment" ADD COLUMN     "batchId" TEXT;

-- AlterTable: CommissionEntry.kind / reversesEntryId
ALTER TABLE "CommissionEntry" ADD COLUMN     "kind" "CommissionEntryKind" NOT NULL DEFAULT 'EARNED',
ADD COLUMN     "reversesEntryId" TEXT;

-- AlterTable: WaitlistEntry offer fields
ALTER TABLE "WaitlistEntry" ADD COLUMN     "offeredBarberId" TEXT,
ADD COLUMN     "offerTokenHash" TEXT,
ADD COLUMN     "offerTokenUsedAt" TIMESTAMP(3);

-- CreateTable: RateLimitBucket
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalePaymentBatch_saleId_idx" ON "SalePaymentBatch"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "SalePaymentBatch_tenantId_idempotencyKey_key" ON "SalePaymentBatch"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SaleRefund_paymentId_key" ON "SaleRefund"("paymentId");

-- DropIndex (replaced by composite unique below)
DROP INDEX "CommissionEntry_saleItemId_key";

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_saleItemId_kind_key" ON "CommissionEntry"("saleItemId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_reversesEntryId_key" ON "CommissionEntry"("reversesEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_offerTokenHash_key" ON "WaitlistEntry"("offerTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_scope_keyHash_windowStart_key" ON "RateLimitBucket"("scope", "keyHash", "windowStart");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_defaultBarberId_fkey" FOREIGN KEY ("defaultBarberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePaymentBatch" ADD CONSTRAINT "SalePaymentBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePaymentBatch" ADD CONSTRAINT "SalePaymentBatch_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SalePaymentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "CommissionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_offeredBarberId_fkey" FOREIGN KEY ("offeredBarberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
