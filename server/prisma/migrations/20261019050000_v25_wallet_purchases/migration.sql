-- V2.5 Step 6 — wallet + CEO purchases (MVP). ADDITIVE ONLY.
--
-- Adds PaymentIntent (OxaPay invoice prep), PaymentWebhookEvent (idempotent
-- webhook log), CeoPurchase (purchase records + exactly-once delivery), four
-- enums, and a DEPOSIT_CREDIT SP ledger source. Existing data is untouched.
-- Apply only after a verified backup and owner approval; payments stay disabled.

-- ---------------------------------------------------------------------------
-- AlterEnum
-- ---------------------------------------------------------------------------
ALTER TYPE "SpSourceType" ADD VALUE 'DEPOSIT_CREDIT';

-- ---------------------------------------------------------------------------
-- CreateEnum
-- ---------------------------------------------------------------------------
CREATE TYPE "PaymentProvider" AS ENUM ('OXAPAY', 'MANUAL');
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'DELIVERED', 'FAILED', 'REFUNDED');

-- ---------------------------------------------------------------------------
-- CreateTable "PaymentIntent"
-- ---------------------------------------------------------------------------
CREATE TABLE "PaymentIntent" (
    "id"          SERIAL                 NOT NULL,
    "userId"      INTEGER                NOT NULL,
    "provider"    "PaymentProvider"      NOT NULL DEFAULT 'OXAPAY',
    "externalId"  TEXT                   NOT NULL,
    "amountUsdt"  DECIMAL(18,6)          NOT NULL,
    "creditedSp"  BIGINT,
    "status"      "PaymentIntentStatus"  NOT NULL DEFAULT 'CREATED',
    "purpose"     TEXT                   NOT NULL DEFAULT 'deposit',
    "payAddress"  TEXT,
    "payUrl"      TEXT,
    "metadata"    JSONB,
    "createdAt"   TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)           NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentIntent_externalId_key" ON "PaymentIntent"("externalId");
CREATE INDEX "PaymentIntent_userId_status_idx" ON "PaymentIntent"("userId", "status");

-- ---------------------------------------------------------------------------
-- CreateTable "PaymentWebhookEvent"
-- ---------------------------------------------------------------------------
CREATE TABLE "PaymentWebhookEvent" (
    "id"              SERIAL                 NOT NULL,
    "provider"        "PaymentProvider"      NOT NULL,
    "eventId"         TEXT                   NOT NULL,
    "paymentIntentId" INTEGER,
    "status"          "PaymentEventStatus"   NOT NULL DEFAULT 'RECEIVED',
    "payload"         JSONB                  NOT NULL,
    "receivedAt"      TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"     TIMESTAMP(3),
    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");
CREATE INDEX "PaymentWebhookEvent_status_idx" ON "PaymentWebhookEvent"("status");

-- ---------------------------------------------------------------------------
-- CreateTable "CeoPurchase"
-- ---------------------------------------------------------------------------
CREATE TABLE "CeoPurchase" (
    "id"              SERIAL           NOT NULL,
    "userId"          INTEGER          NOT NULL,
    "ceoId"           INTEGER          NOT NULL,
    "priceUsdSnap"    DECIMAL(12,2)    NOT NULL,
    "status"          "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" INTEGER,
    "ownedCeoId"      INTEGER,
    "idempotencyKey"  TEXT             NOT NULL,
    "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)     NOT NULL,
    "paidAt"          TIMESTAMP(3),
    "deliveredAt"     TIMESTAMP(3),
    CONSTRAINT "CeoPurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CeoPurchase_ownedCeoId_key" ON "CeoPurchase"("ownedCeoId");
CREATE UNIQUE INDEX "CeoPurchase_idempotencyKey_key" ON "CeoPurchase"("idempotencyKey");
CREATE INDEX "CeoPurchase_userId_status_idx" ON "CeoPurchase"("userId", "status");

-- ---------------------------------------------------------------------------
-- AddForeignKey
-- ---------------------------------------------------------------------------
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CeoPurchase" ADD CONSTRAINT "CeoPurchase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CeoPurchase" ADD CONSTRAINT "CeoPurchase_ceoId_fkey"
  FOREIGN KEY ("ceoId") REFERENCES "CEO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CeoPurchase" ADD CONSTRAINT "CeoPurchase_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
