# TycoonX — Engineering Decisions Log

Short, authoritative record of decisions that affect how we develop. Product rules live in
`docs/TYCOONX_V2_MASTER_SPEC.md`; implementation status in `docs/PROGRESS.md`. Keep entries brief.

## Databases and environments
- **Production branch:** Neon branch `br-delicate-butterfly-b4et73g9` (project `wandering-king-57462138`).
  Protected. Never target from a local machine. Do not modify to fix a local issue.
- **Isolated dev/integration branch:** `br-floral-resonance-b4ruvusw` (`test-ownership-6c1`, same project).
  This is the sanctioned local development and integration-testing target. The former
  `br-plain-forest-b4zbd6xf` branch was deleted.
- **Local `server/.env` (git-ignored):** `TEST_DATABASE_URL` = the isolated branch's direct host;
  `DATABASE_URL` / `DIRECT_URL` = the same branch's pooled host (kept distinct so the integration guard's
  "TEST must not equal DATABASE_URL/DIRECT_URL" check passes). Secrets are never printed or committed.
- The integration suite refuses to run when `TEST_DATABASE_URL` equals `DATABASE_URL`/`DIRECT_URL` (a
  safety guard). That is why the app and the test URL use the isolated branch's **different hosts**
  (direct vs pooled) rather than identical strings.

## Migrations
- `npx prisma migrate deploy` fails locally with `P1001` (the Prisma CLI's TCP engine cannot reach Neon
  from this environment).
- **Isolated branch:** apply additive migrations with the serverless driver (`@neondatabase/serverless`),
  behind a hard `neon.branch_id` guard, recording `_prisma_migrations` history with the migration file's
  SHA-256 checksum.
- **Production:** apply only through the guarded GitHub Actions migration workflows, after a verified
  backup/PITR point. Production may lag the repo; verify before deploying code that depends on new schema.
- **Never** reset the database, drop data, or run destructive migrations.

## Economy and payouts (production-aligned)
- **The production Neon CEO catalog is authoritative for production rates** (verified read-only 2026-10-27).
  Nominal SP/24h: Intern **120**, Junior Developer **600**, Product Manager **2,166**, Marketing Director
  **9,333**, Startup Founder **18,750**, AI Architect **40,000**, Cloud Executive **90,000**, Tech Billionaire
  **400,000**; Intern lifetime cap **500**. Prices and premium lifetime caps are unchanged. Cycle duration is
  unchanged (`CEO.cycleHours = 4`; equipment 4/6/8h). The applied migration
  `20261018000000_v25_economy_sp_production` embeds the *earlier* rates — **do not edit or re-run it**; sync any
  other environment only via a new additive migration.
- **Withdrawal policy (owner-approved):** USDT BEP20 only; minimum **1,000 Earned SP (1 USDT)**; flat player fee
  **0.25 USDT** (no platform margin). A 1.00 USDT request nets exactly **0.75 USDT**. Admin approval and the
  separate Submit Payout action are mandatory.
- **Payout fee semantics are owner-verified:** OxaPay bills its BEP20 payout fee from the merchant balance
  ("merchant"), so the requested amount reaches the recipient in full. `DEFAULT_PAYOUT_FEE_SEMANTICS="merchant"`
  makes a blank/unset `OXAPAY_PAYOUT_FEE_SEMANTICS` **deploy-safe** — a missing variable cannot disable payouts.
  Only an unrecognized explicit value fails closed. Under an explicit "payer", the provider fee is added once
  before submission so the recipient still nets exactly the player net (never deducted twice).

## Financial feature flags
- `PAYMENTS_ENABLED`, `PAYOUTS_ENABLED`, `REFERRAL_REWARDS_ENABLED` are independent server-side gates,
  **disabled by default**; only the exact value `"true"` enables one. Internal CEO purchases using existing
  SP balances are independent of `PAYMENTS_ENABLED`.
- Enabling any financial feature is a **final release step** requiring its individual readiness gates and
  explicit owner approval. Never activate during development or testing. No real provider transactions
  without a separately approved test procedure.

## Reliability and testing
- Async route errors are captured centrally (`express-async-errors`) and answered as JSON `500` by
  `server/src/lib/errorHandling.ts`; a log-only `unhandledRejection` guard prevents process death.
- Verification set: `npm test --workspace=server`, `npm run test:integration --workspace=server`
  (isolated branch), `npm run build --workspace=server`, `npm run build --prefix client`,
  `npx prisma validate`.
- CI (`.github/workflows/ci.yml`) runs unit tests, both builds, and Prisma validate on push/PR. It does not
  deploy and does not enable flags.

## Git
- Local checkpoint commits are allowed for safety; **no push, deploy, or history rewrite without explicit
  approval**. Preserve existing user changes and untracked files.
