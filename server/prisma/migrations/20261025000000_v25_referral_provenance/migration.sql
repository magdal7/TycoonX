-- V2.5 referral funding provenance.
-- Additive and non-destructive. All new columns default to 0.
--
-- Deposit-funded Bonus SP is tracked separately so referral commissions are only
-- generated from Bonus SP backed by confirmed real deposits. Legacy Bonus SP is
-- intentionally NOT classified as deposit-funded (existing rows default to 0);
-- no historical balance is retroactively reclassified.

ALTER TABLE "SpAccount" ADD COLUMN "depositFundedBonusSp" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "SpLedgerEntry" ADD COLUMN "depositFundedSp" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "CeoPurchase" ADD COLUMN "depositFundedSp" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ReferralPurchaseEvent" ADD COLUMN "depositFundedSp" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ReferralReward" ADD COLUMN "heldSp" BIGINT NOT NULL DEFAULT 0;

ALTER TYPE "SpSourceType" ADD VALUE IF NOT EXISTS 'REFERRAL_REVERSAL';
