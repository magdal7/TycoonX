-- V2.5 Step 5 — referral system. ADDITIVE ONLY.
--
-- Extends ReferralAttribution with explicit qualification state and abuse
-- fingerprints, and adds ReferralReward + ReferralPurchaseEvent. Existing
-- attribution rows are preserved; the legacy `eligible` flag is backfilled into
-- the new status. No CEO/economy fields are touched. Apply only after a verified
-- backup and owner approval.

-- ---------------------------------------------------------------------------
-- CreateEnum
-- ---------------------------------------------------------------------------
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REJECTED', 'REVOKED');
CREATE TYPE "ReferralRewardKind" AS ENUM ('REGISTRATION_BONUS', 'PURCHASE_COMMISSION');
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'PAID', 'REVERSED');
CREATE TYPE "ReferralPurchaseStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED', 'REFUNDED', 'CHARGEBACK', 'DUPLICATE');

-- ---------------------------------------------------------------------------
-- AlterTable "ReferralAttribution"
-- ---------------------------------------------------------------------------
ALTER TABLE "ReferralAttribution" ADD COLUMN "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ReferralAttribution" ADD COLUMN "qualifiedAt" TIMESTAMP(3);
ALTER TABLE "ReferralAttribution" ADD COLUMN "reviewedBy" INTEGER;
ALTER TABLE "ReferralAttribution" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "ReferralAttribution" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "ReferralAttribution" ADD COLUMN "signupIpHash" TEXT;
ALTER TABLE "ReferralAttribution" ADD COLUMN "signupUserAgentHash" TEXT;
ALTER TABLE "ReferralAttribution" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Data-preserving backfill of the legacy boolean into the new status.
UPDATE "ReferralAttribution"
  SET "status" = 'QUALIFIED', "qualifiedAt" = "createdAt"
  WHERE "eligible" = true;

CREATE INDEX "ReferralAttribution_referrerId_status_idx" ON "ReferralAttribution"("referrerId", "status");
CREATE INDEX "ReferralAttribution_signupIpHash_idx" ON "ReferralAttribution"("signupIpHash");

-- ---------------------------------------------------------------------------
-- CreateTable "ReferralReward"
-- ---------------------------------------------------------------------------
CREATE TABLE "ReferralReward" (
    "id"             SERIAL                  NOT NULL,
    "referralId"     INTEGER                 NOT NULL,
    "kind"           "ReferralRewardKind"    NOT NULL,
    "status"         "ReferralRewardStatus"  NOT NULL DEFAULT 'PENDING',
    "amountSp"       BIGINT                  NOT NULL,
    "currency"       TEXT                    NOT NULL DEFAULT 'BONUS_SP',
    "purchaseRef"    TEXT                    NOT NULL DEFAULT '',
    "ledgerSourceId" BIGINT,
    "reason"         TEXT,
    "createdAt"      TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)            NOT NULL,
    "paidAt"         TIMESTAMP(3),
    "reversedAt"     TIMESTAMP(3),
    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralReward_referralId_kind_purchaseRef_key"
  ON "ReferralReward"("referralId", "kind", "purchaseRef");
CREATE INDEX "ReferralReward_referralId_idx" ON "ReferralReward"("referralId");
CREATE INDEX "ReferralReward_status_idx" ON "ReferralReward"("status");

-- ---------------------------------------------------------------------------
-- CreateTable "ReferralPurchaseEvent"
-- ---------------------------------------------------------------------------
CREATE TABLE "ReferralPurchaseEvent" (
    "id"             SERIAL                     NOT NULL,
    "referralId"     INTEGER                    NOT NULL,
    "referredUserId" INTEGER                    NOT NULL,
    "purchaseRef"    TEXT                       NOT NULL,
    "valueSp"        BIGINT                     NOT NULL,
    "status"         "ReferralPurchaseStatus"   NOT NULL DEFAULT 'PENDING',
    "occurredAt"     TIMESTAMP(3)               NOT NULL,
    "metadata"       JSONB,
    "createdAt"      TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)               NOT NULL,
    CONSTRAINT "ReferralPurchaseEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralPurchaseEvent_purchaseRef_key" ON "ReferralPurchaseEvent"("purchaseRef");
CREATE INDEX "ReferralPurchaseEvent_referralId_idx" ON "ReferralPurchaseEvent"("referralId");
CREATE INDEX "ReferralPurchaseEvent_status_idx" ON "ReferralPurchaseEvent"("status");

-- ---------------------------------------------------------------------------
-- AddForeignKey
-- ---------------------------------------------------------------------------
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "ReferralAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPurchaseEvent" ADD CONSTRAINT "ReferralPurchaseEvent_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "ReferralAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
