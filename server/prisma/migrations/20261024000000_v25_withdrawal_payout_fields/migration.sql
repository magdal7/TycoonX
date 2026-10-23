-- V2.5 withdrawal payout auditability: provider track id + settlement timestamp.
-- Additive and non-destructive. Existing rows default to NULL; no data is modified.

ALTER TABLE "WithdrawalRequest" ADD COLUMN "payoutTrackId" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "paidAt" TIMESTAMP(3);
