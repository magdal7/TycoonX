-- Phase 6B.1 — Economy V2 additive foundation.
-- Generated offline with `prisma migrate diff` (datamodel -> datamodel) and extended by hand.
-- Additive only: new enums, new tables, new nullable/defaulted "CEO" columns, indexes, FKs and seed.
-- Existing "User"/"CEO" columns and rows are preserved; historical migrations are NOT replayed.
-- Apply ONLY after a verified Neon backup exists (see docs/PHASE_6B1_IMPLEMENTATION_REPORT.md).
-- Recommended: apply inside a single transaction.

-- ---------------------------------------------------------------------------
-- Drift reconciliation: "AppMeta" is defined in schema.prisma but was never
-- created in the database (and is absent from the historical migration folder).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AppMeta" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppMeta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppMeta_key_key" ON "AppMeta"("key");

-- ---------------------------------------------------------------------------
-- CreateEnum
-- ---------------------------------------------------------------------------
CREATE TYPE "AcquisitionType" AS ENUM ('STARTER', 'PURCHASE', 'MISSION', 'REWARD', 'ADMIN');

-- CreateEnum
CREATE TYPE "OwnedCeoStatus" AS ENUM ('IDLE', 'PRODUCING', 'READY_TO_COLLECT', 'EXHAUSTED', 'PAUSED', 'DISABLED');

-- ---------------------------------------------------------------------------
-- AlterTable: additive economy columns on the existing "CEO" catalog table
-- ---------------------------------------------------------------------------
ALTER TABLE "CEO" ADD COLUMN     "baseSpPerCycle" INTEGER,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isStarter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxOwned" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rewardEligible" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- CreateTable
-- ---------------------------------------------------------------------------
CREATE TABLE "OwnedCeo" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,
    "acquisitionType" "AcquisitionType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "cycleLimit" INTEGER,
    "completedRewardCycles" INTEGER NOT NULL DEFAULT 0,
    "status" "OwnedCeoStatus" NOT NULL DEFAULT 'IDLE',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnedCeo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
    "id" SERIAL NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "referredUserId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyKey" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- CreateIndex
-- ---------------------------------------------------------------------------
CREATE INDEX "OwnedCeo_userId_idx" ON "OwnedCeo"("userId");

CREATE INDEX "OwnedCeo_templateId_idx" ON "OwnedCeo"("templateId");

CREATE INDEX "OwnedCeo_userId_status_idx" ON "OwnedCeo"("userId", "status");

CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");

CREATE INDEX "ReferralAttribution_referrerId_idx" ON "ReferralAttribution"("referrerId");

CREATE UNIQUE INDEX "IdempotencyKey_userId_scope_key_key" ON "IdempotencyKey"("userId", "scope", "key");

-- ---------------------------------------------------------------------------
-- AddForeignKey
-- ---------------------------------------------------------------------------
ALTER TABLE "OwnedCeo" ADD CONSTRAINT "OwnedCeo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnedCeo" ADD CONSTRAINT "OwnedCeo_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CEO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Database-level business constraints (not expressible in the Prisma DSL)
-- ---------------------------------------------------------------------------

-- One starter CEO per user (partial unique index = concurrency backstop).
CREATE UNIQUE INDEX "OwnedCeo_starter_user_key" ON "OwnedCeo"("userId") WHERE "acquisitionType" = 'STARTER';

-- Referrals cannot be self-referential.
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_no_self" CHECK ("referrerId" <> "referredUserId");

-- ---------------------------------------------------------------------------
-- Seed: map approved development-only values onto EXISTING catalog rows by
-- stable "slug". Existing rows are updated, never recreated.
-- ---------------------------------------------------------------------------
UPDATE "CEO" SET "baseSpPerCycle" = 20,  "maxOwned" = 10 WHERE "slug" = 'junior-developer';
UPDATE "CEO" SET "baseSpPerCycle" = 40,  "maxOwned" = 8  WHERE "slug" = 'product-manager';
UPDATE "CEO" SET "baseSpPerCycle" = 65,  "maxOwned" = 7  WHERE "slug" = 'marketing-director';
UPDATE "CEO" SET "baseSpPerCycle" = 95,  "maxOwned" = 6  WHERE "slug" = 'startup-founder';
UPDATE "CEO" SET "baseSpPerCycle" = 150, "maxOwned" = 5  WHERE "slug" = 'ai-architect';
UPDATE "CEO" SET "baseSpPerCycle" = 230, "maxOwned" = 4  WHERE "slug" = 'cloud-executive';
UPDATE "CEO" SET "baseSpPerCycle" = 400, "maxOwned" = 3  WHERE "slug" = 'tech-billionaire';
UPDATE "CEO" SET "baseSpPerCycle" = 600, "maxOwned" = 2  WHERE "slug" = 'crypto-whale';

-- Free Intern CEO starter template (idempotent by "slug").
-- energyCost/rarity/category are illustrative defaults pending final sign-off.
-- NOTE: "updatedAt" is NOT NULL with no database default on this table, so it is
-- set explicitly here to avoid the not-null failure seen in the historical seed.
INSERT INTO "CEO" (
    "name", "slug", "rarity", "priceUsd", "dailyRatePercent", "cycleHours", "energyCost", "isActive",
    "baseSpPerCycle", "maxOwned", "isStarter", "rewardEligible", "category", "displayOrder", "updatedAt"
) VALUES (
    'Intern CEO', 'intern-ceo', 'Common', 0.00, 0.0000, 4, 2, true,
    10, 1, true, false, 'Starter', 0, CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
