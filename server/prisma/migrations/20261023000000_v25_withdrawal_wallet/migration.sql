-- V2.5 withdrawal wallet security: saved BEP20 wallet + change-hold timestamp.
-- Additive and non-destructive. No data loss; existing users default to NULL
-- (no saved wallet) and set one on their next withdrawal request or via the
-- wallet endpoint.

ALTER TABLE "User" ADD COLUMN "withdrawalWallet" TEXT;
ALTER TABLE "User" ADD COLUMN "withdrawalWalletChangedAt" TIMESTAMP(3);
