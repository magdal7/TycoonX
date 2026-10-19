-- V2.5 Step 4 — admin management. ADDITIVE ONLY.
--
-- Adds account-suspension columns to "User" and catalog-presentation columns
-- (imageUrl, isForSale) to "CEO". No existing column is dropped or altered; no
-- production/economy field is changed. Apply only after a verified backup and
-- owner approval.

-- ---------------------------------------------------------------------------
-- AlterTable "User"
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspensionReason" TEXT;

-- ---------------------------------------------------------------------------
-- AlterTable "CEO"
-- ---------------------------------------------------------------------------
ALTER TABLE "CEO" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "CEO" ADD COLUMN "isForSale" BOOLEAN NOT NULL DEFAULT true;
