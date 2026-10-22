-- V2.5 — add the CEO purchase SP ledger source (additive enum value only).
-- Enables atomic server-side SP deduction (Bonus first, then Earned) for CEO
-- purchases. No data is modified; apply before deploying the purchase code.
ALTER TYPE "SpSourceType" ADD VALUE 'CEO_PURCHASE';
