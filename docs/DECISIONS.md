# TycoonX — Engineering Decisions Log

Short, authoritative record of decisions that affect how we develop. Product rules live in
`docs/TYCOONX_V2_MASTER_SPEC.md`; implementation status in `docs/PROGRESS.md`. Keep entries brief.

## Databases and environments
- **Production branch:** Neon branch `br-delicate-butterfly-b4et73g9` (project `wandering-king-57462138`).
  Protected. Never target from a local machine. Do not modify to fix a local issue.
- **Isolated dev/integration branch:** `br-plain-forest-b4zbd6xf` (same project). This is the sanctioned
  local development and integration-testing target.
- **Local `server/.env` (git-ignored):** `DATABASE_URL` / `DIRECT_URL` point at the isolated branch's
  direct host; `TEST_DATABASE_URL` points at the isolated branch. The original production values are kept
  as commented lines for reference only. Secrets are never printed or committed.
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
