-- V2.5 Step 3 — admin foundation + special tasks. ADDITIVE ONLY.
--
-- Creates three new tables (SpecialTask, SpecialTaskSubmission, AdminAuditLog) and
-- three new enums. No existing table/column/type is altered or dropped. Apply only
-- after a verified backup and owner approval; recommend a single transaction.

-- ---------------------------------------------------------------------------
-- CreateEnum
-- ---------------------------------------------------------------------------
CREATE TYPE "SpecialTaskStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "SpecialTaskVerification" AS ENUM ('MANUAL', 'AUTO');
CREATE TYPE "SpecialTaskSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CLAIMED');

-- ---------------------------------------------------------------------------
-- CreateTable
-- ---------------------------------------------------------------------------
CREATE TABLE "SpecialTask" (
    "id"                SERIAL                     NOT NULL,
    "title"             TEXT                       NOT NULL,
    "description"       TEXT                       NOT NULL,
    "link"              TEXT,
    "proofInstructions" TEXT,
    "rewardXp"          INTEGER                    NOT NULL DEFAULT 0,
    "rewardBonusSp"     BIGINT                     NOT NULL DEFAULT 0,
    "status"            "SpecialTaskStatus"        NOT NULL DEFAULT 'DRAFT',
    "verification"      "SpecialTaskVerification"  NOT NULL DEFAULT 'MANUAL',
    "minLevel"          INTEGER                    NOT NULL DEFAULT 1,
    "maxCompletions"    INTEGER,
    "completionsCount"  INTEGER                    NOT NULL DEFAULT 0,
    "startsAt"          TIMESTAMP(3),
    "expiresAt"         TIMESTAMP(3),
    "createdBy"         INTEGER                    NOT NULL,
    "publishedAt"       TIMESTAMP(3),
    "archivedAt"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)               NOT NULL,
    CONSTRAINT "SpecialTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpecialTask_status_expiresAt_idx" ON "SpecialTask"("status", "expiresAt");
CREATE INDEX "SpecialTask_createdBy_idx" ON "SpecialTask"("createdBy");

CREATE TABLE "SpecialTaskSubmission" (
    "id"                SERIAL                            NOT NULL,
    "taskId"            INTEGER                           NOT NULL,
    "userId"            INTEGER                           NOT NULL,
    "status"            "SpecialTaskSubmissionStatus"     NOT NULL DEFAULT 'PENDING',
    "attempt"           INTEGER                           NOT NULL DEFAULT 1,
    "proofText"         TEXT,
    "proofUrl"          TEXT,
    "rewardXpSnap"      INTEGER                           NOT NULL,
    "rewardBonusSpSnap" BIGINT                            NOT NULL,
    "reserved"          BOOLEAN                           NOT NULL DEFAULT false,
    "reviewNote"        TEXT,
    "reviewedBy"        INTEGER,
    "reviewedAt"        TIMESTAMP(3),
    "claimedAt"         TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)                      NOT NULL,
    CONSTRAINT "SpecialTaskSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpecialTaskSubmission_taskId_userId_attempt_key"
  ON "SpecialTaskSubmission"("taskId", "userId", "attempt");
CREATE INDEX "SpecialTaskSubmission_userId_status_idx" ON "SpecialTaskSubmission"("userId", "status");
CREATE INDEX "SpecialTaskSubmission_taskId_status_idx" ON "SpecialTaskSubmission"("taskId", "status");

CREATE TABLE "AdminAuditLog" (
    "id"         SERIAL       NOT NULL,
    "actorId"    INTEGER      NOT NULL,
    "action"     TEXT         NOT NULL,
    "targetType" TEXT         NOT NULL,
    "targetId"   TEXT         NOT NULL,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- ---------------------------------------------------------------------------
-- AddForeignKey
-- ---------------------------------------------------------------------------
ALTER TABLE "SpecialTaskSubmission" ADD CONSTRAINT "SpecialTaskSubmission_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "SpecialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialTaskSubmission" ADD CONSTRAINT "SpecialTaskSubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
