-- V2.5 registration policy consent — additive, non-destructive.
--
-- Records each user's acceptance of the Terms of Service and Privacy Policy
-- with the exact policy versions and the server-side acceptance timestamp.
-- Additive only: creates a new table and its indexes; no existing table or
-- column is altered. Apply only after a verified backup and owner approval.

-- ---------------------------------------------------------------------------
-- CreateTable
-- ---------------------------------------------------------------------------
CREATE TABLE "PolicyConsent" (
    "id"             SERIAL       NOT NULL,
    "userId"         INTEGER      NOT NULL,
    "termsVersion"   TEXT         NOT NULL,
    "privacyVersion" TEXT         NOT NULL,
    "acceptedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyConsent_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- CreateIndex
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "PolicyConsent_userId_termsVersion_privacyVersion_key"
  ON "PolicyConsent"("userId", "termsVersion", "privacyVersion");
CREATE INDEX "PolicyConsent_userId_idx" ON "PolicyConsent"("userId");

-- ---------------------------------------------------------------------------
-- AddForeignKey
-- ---------------------------------------------------------------------------
ALTER TABLE "PolicyConsent" ADD CONSTRAINT "PolicyConsent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
