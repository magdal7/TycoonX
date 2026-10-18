-- V2.5 progression & retention — additive: tasks/events, achievements, profiles, withdrawal requests.
-- Extends the V2.5 economy migration (which must be applied first). ADDITIVE ONLY.
-- Apply ONLY after a verified backup and owner approval; recommend a single transaction.

-- ---------------------------------------------------------------------------
-- CreateEnum
-- ---------------------------------------------------------------------------
CREATE TYPE "TaskEventType" AS ENUM ('LOGIN', 'CYCLE_START', 'CYCLE_COLLECT');
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'ON_HOLD', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAID');

-- ---------------------------------------------------------------------------
-- CreateTable
-- ---------------------------------------------------------------------------
CREATE TABLE "TaskEvent" (
    "id"        SERIAL         NOT NULL,
    "userId"    INTEGER        NOT NULL,
    "type"      "TaskEventType" NOT NULL,
    "createdAt" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskEvent_userId_type_createdAt_idx" ON "TaskEvent"("userId", "type", "createdAt");
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TaskClaim" (
    "id"        SERIAL       NOT NULL,
    "userId"    INTEGER      NOT NULL,
    "taskKey"   TEXT         NOT NULL,
    "periodKey" TEXT         NOT NULL,
    "xpAwarded" INTEGER      NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskClaim_userId_taskKey_periodKey_key" ON "TaskClaim"("userId", "taskKey", "periodKey");
CREATE INDEX "TaskClaim_userId_periodKey_idx" ON "TaskClaim"("userId", "periodKey");
ALTER TABLE "TaskClaim" ADD CONSTRAINT "TaskClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AchievementClaim" (
    "id"        SERIAL       NOT NULL,
    "userId"    INTEGER      NOT NULL,
    "trackKey"  TEXT         NOT NULL,
    "stage"     TEXT         NOT NULL,
    "xpAwarded" INTEGER      NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AchievementClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AchievementClaim_userId_trackKey_stage_key" ON "AchievementClaim"("userId", "trackKey", "stage");
ALTER TABLE "AchievementClaim" ADD CONSTRAINT "AchievementClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserProfile" (
    "userId"    INTEGER      NOT NULL,
    "avatarKey" TEXT         NOT NULL DEFAULT 'founder-1',
    "featured"  JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WithdrawalRequest" (
    "id"         SERIAL      NOT NULL,
    "userId"     INTEGER     NOT NULL,
    "grossSp"    BIGINT      NOT NULL,
    "feeUsdt"    DECIMAL(12,2) NOT NULL,
    "netUsdt"    DECIMAL(12,2) NOT NULL,
    "address"    TEXT        NOT NULL,
    "network"    TEXT        NOT NULL DEFAULT 'BEP20',
    "status"     "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "note"       TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WithdrawalRequest_userId_status_idx" ON "WithdrawalRequest"("userId", "status");
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
