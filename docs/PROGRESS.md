# TycoonX — Implementation Status (PROGRESS)

Canonical status file. Product rules live in `docs/TYCOONX_V2_MASTER_SPEC.md` (do not duplicate rules here).
Last updated: 2026-10-26.

## Production alignment & withdrawal compatibility (2026-10-27)
- **Production reconciled (read-only).** VPS `/opt/tycoonx` ran commit `a64ada2` (equal to committed local HEAD
  at reconciliation time) from TypeScript source via `tsx` (`tycoonx.service`). Production env:
  `PAYMENTS_ENABLED=true`, `PAYOUTS_ENABLED=true`, `REFERRAL_REWARDS_ENABLED=true`, `DEPOSIT_ACCESS_MODE=all`,
  `OXAPAY_SANDBOX=false`. Migration history = **15** rows (matches the repo); `20261025000000_v25_referral_provenance`
  already applied. No secrets printed or copied.
- **CEO economy (production DB, authoritative).** Nominal SP/24h changed (Intern 120, Junior 600, PM 2,166,
  Marketing 9,333, Startup 18,750, AI 40,000, Cloud 90,000, Tech Billionaire 400,000) and Intern lifetime cap
  40 → 500. Prices and premium caps unchanged; `CEO.cycleHours` unchanged (4). Synced into Master Spec §3 and
  `DECISIONS.md`; the applied economy migration was **not** edited and no seed was run.
- **Withdrawal fee/minimum (owner-approved).** Flat player fee **0.25 USDT**, minimum **1,000 Earned SP
  (1 USDT)**; a 1.00 USDT request nets **0.75 USDT** (no platform margin).
- **Payout compatibility fix.** Added `DEFAULT_PAYOUT_FEE_SEMANTICS="merchant"` so a missing/blank
  `OXAPAY_PAYOUT_FEE_SEMANTICS` resolves to the owner-verified behavior instead of blocking payouts; the
  fail-closed guard is preserved (unrecognized explicit values still block). Under explicit "payer" the provider
  fee is added once before submission so the recipient still nets exactly the player net. No double deduction.

## Release candidate — financial hardening + artwork integration (2026-10-26)
All three financial gates remain fail-closed (`PAYMENTS_ENABLED=false`, `PAYOUTS_ENABLED=false`,
`REFERRAL_REWARDS_ENABLED=false`); no production flags, credentials, or DB were touched.
- **Deposits — resume/dedupe + expiry:** `createDepositIntent` now retires expired open invoices
  (`expireStaleDepositIntents`) and **resumes an existing matching open invoice** for the same user,
  amount and canonical asset/network instead of creating duplicates (repeated clicks/refreshes/retries).
  Verified callbacks now record `lastProviderStatus` on the intent; an `expired` provider status marks an
  open intent `EXPIRED` (guarded). Underpayment/overpayment/`manual_accept`/`underpaid` are recorded
  explicitly and **never credit**; only an exact-amount `paid` with a verified allowlisted pair settles.
- **Deposits — client:** single **Continue to Payment** action; invoice expiry, provider status, minimum
  (`minDepositUsdt`), access mode and the verified asset/network allowlist are **server-provided**
  (`GET /api/game/deposits`), so the client no longer hardcodes them.
- **Withdrawals — server-sourced policy + fee safety:** `GET /api/game/withdrawals` now returns a
  `policy` (min gross, flat fee, min net, network, provider fee, semantics). The client reads it instead
  of hardcoding `1000 SP` / `0.25 USDT`. The confirmed **0.25 USDT** OxaPay BEP20 provider fee is surfaced
  separately. Real payout execution is **fail-closed** with a new guard: it stays blocked
  (`payout_fee_semantics_unverified`) until `OXAPAY_PAYOUT_FEE_SEMANTICS` confirms whether the provider
  deducts its fee from the payout amount or the merchant balance (Master Spec §9, unresolved).
- **Withdrawals — owner-approved values (2026-10-27):** player flat fee lowered to **0.25 USDT**
  (250 SP; the previous 0.05 USDT margin removed) and minimum lowered to **1,000 Earned SP = 1 USDT**.
  A minimum request is gross **1.00** / fee **0.25** / net **0.75** USDT. Server-authoritative policy,
  client displays and tests updated; provider fee semantics remain fail-closed.
- **Referrals:** the player page now uses the server runtime flag `rewardsEnabled` for its badge/copy
  instead of a hardcoded "pending approval" message; single-level rules unchanged.
- **Gameplay clarity:** Market shows the player's SP balance, per-card affordability and shortfall, and
  Bonus-first spending; Home shows remaining lifetime capacity per copy and equipment-upgrade
  explanations (longer cycles yield proportionally more per collection; hourly rate unchanged; applies to
  future cycles). No prices, rates, caps, or rewards changed.
- **CEO artwork:** the eight bundled portraits (`client/public/assets/game/ceos/*.jpg`, verified present)
  are wired through `imageUrl` exposed by `GET /api/ceos`, `GET /api/ceos/:id`, `GET /api/public/ceos` and
  the owned fleet (`templateImageUrl`). `CeoAvatar` prefers catalog art, then the bundled portrait, then
  the generated SVG fallback (lazy/responsive, CSP/PWA safe). Manifest + generation prompts in
  `docs/CEO_ARTWORK.md`. Bundled art requires no DB migration or economy change.
- **Verification:** unit **277/277**; isolated integration **16/16** (added resume/expiry coverage;
  `br-floral-resonance-b4ruvusw`, PAYOUTS fee-semantics configured for the payout tests); HTTP smoke
  **71/71** (now deterministic: the run pins the spawned server's financial gates and asserts consistently);
  server `tsc`, client PWA build, and `prisma validate` all pass. Integration/smoke are latency-sensitive
  against the cold Neon branch (occasionally need a retry); a prior smoke inconsistency (contradictory
  `paymentsEnabled` expectations) is fixed.
- **Activation (separate owner approval required, not done here):** deposits via `PAYMENTS_ENABLED` +
  `DEPOSIT_ACCESS_MODE=all`; payouts via `PAYOUTS_ENABLED` **and** a confirmed
  `OXAPAY_PAYOUT_FEE_SEMANTICS`; referral rewards via `REFERRAL_REWARDS_ENABLED` after the economics are
  approved and the referral-provenance migration is applied.

## Final release preparation (2026-10-25)
- **Production-cycle integration fix:** the Prisma interactive-transaction default 5s timeout was
  exceeded on Neon under load; `startProduction`, `collectProduction`, and `upgradeEquipment` now open
  their transactions with `{ maxWait: 15_000, timeout: 30_000 }` (matching `services/referrals.ts`).
- **Isolated test branch reconciled:** `br-floral-resonance-b4ruvusw` already carried the
  referral-provenance DDL but had no history row; `20261025000000_v25_referral_provenance` was recorded
  through a guarded, idempotent metadata write (**no DDL repeated; production untouched**). Branch
  history is now 15 rows.
- **Referral production migration prepared:** `neon-migration-referral-provenance.yml` (guarded: typed
  confirmation token, branch/project identity, frozen baseline checksums, transaction-safety scan,
  fail-closed financial gates, single-transaction apply, effect + 15-row history verification). **Not
  dispatched.** Do not deploy the referral-provenance build before it succeeds; referral rewards stay
  `REFERRAL_REWARDS_ENABLED=false` until then.
- **Cloudflare Pages SPA fix:** removed the invalid `/* /index.html 200` proxy rule from
  `client/public/_redirects` (Cloudflare rejects it as an infinite loop). Pages' native SPA fallback
  (no top-level `404.html`) serves `index.html` for client routes; `/api/*` remains edge-routed before
  Pages. CSP, security headers, and PWA caching are unchanged.
- **Verified:** unit **270/270**, integration **15/15** (isolated branch; no skips), server `tsc`,
  `prisma validate`, and client PWA build all pass.

## Production OxaPay deposits activated (2026-10-24)
- **First real deposit verified and settled.** OxaPay Track ID `169128788` (ADMIN user 7, order
  `dep_d98f4231-…`, **1 USDT on Binance Smart Chain**) was confirmed final by the provider (15
  confirmations). TycoonX recorded it `CONFIRMED` and credited **exactly one** ledger entry
  (`DEPOSIT_CREDIT`, BONUS, **+1,000 Bonus SP**); total `DEPOSIT_CREDIT` rows = 1 (no duplicate).
  Wallet summary and admin payment history both show it.
- **Incident (fixed, commit `a695e75`):** the paid callback was initially recorded `IGNORED`
  (`unsupported_pair`) and no SP was credited. Root cause: OxaPay invoice callbacks carry the
  invoice/fiat currency in top-level `currency` (`"USD"`); the paid crypto asset lives in
  `txs[].currency`. The webhook route preferred the top-level value. Fixed by `resolveCallbackAsset`
  (prefer transaction asset; tested) and by letting `processWebhook` safely re-evaluate a prior
  `IGNORED` event that was matched to an intent — exactly-once is still guaranteed by the SP-ledger
  unique source key. The stuck invoice was recovered through the idempotent `reconcileDepositIntent`
  path (no manual balance edits).
- **Global deposits enabled:** `PAYMENTS_ENABLED="true"`, `DEPOSIT_ACCESS_MODE="all"`,
  `OXAPAY_SANDBOX="false"` (production, `/opt/tycoonx/server/.env`, perms `600`). Unauthenticated
  invoice creation returns 401; webhook without a valid HMAC returns 401. Supported asset/network
  allowlist and provider-verified minimum (0.01 USDT) unchanged; payer-covers-fees
  (`fee_paid_by_payer=1`) preserved.
- **Still disabled:** `PAYOUTS_ENABLED="false"` (payout go-live gates not met) and
  `REFERRAL_REWARDS_ENABLED="false"` (commission currency, qualification criteria and refund
  handling remain unresolved per Master Spec §8).
- **Also fixed in `a695e75`:** unhandled `InsufficientSpError` on `POST /api/game/withdrawals`
  (now a mapped 409/422); production `TRUST_PROXY=1` (Caddy behind Cloudflare) so rate limiting is
  no longer keyed on `127.0.0.1`; Wallet/Market copy reflects live flags.

## Referral rewards implemented (2026-10-25) — activation BLOCKED on migration
Implemented the approved referral economics on top of the existing system (minimal changes).
- **Funding provenance:** `SpAccount.depositFundedBonusSp`, `SpLedgerEntry.depositFundedSp`,
  `CeoPurchase.depositFundedSp`, `ReferralPurchaseEvent.depositFundedSp`, `ReferralReward.heldSp`, and a
  new `SpSourceType.REFERRAL_REVERSAL`. Only `DEPOSIT_CREDIT` Bonus SP (`depositFunded: true`) counts;
  legacy/ promotional Bonus SP is NOT reclassified.
- **Deterministic allocation:** purchases spend deposit-funded Bonus SP first, then other Bonus SP, then
  Earned SP; the deposit-funded portion is the ONLY commission base.
- **Qualification:** the first eligible confirmed purchase auto-qualifies the invitee and credits the
  10 Bonus SP reward exactly once (manual Admin review preserved).
- **Commission:** recurring 10% Bonus SP on the deposit-funded portion only (exactly-once via the reward
  unique key).
- **Reversal:** refunds/chargebacks reverse the commission and, if the qualifying purchase is reversed,
  invalidate qualification + its reward. Recovery is **Bonus-only** (non-deposit first, then
  deposit-funded); any shortfall is recorded as `heldSp` — Earned SP is never touched.
- **UI:** Referrals page (rules, commission + reversal history, held amounts) and Admin reward records.
- **Migration (prepared, NOT applied):** `20261025000000_v25_referral_provenance` (additive; 5 columns +
  1 enum value).
- **BLOCKER:** the new code reads the new columns, so it MUST NOT be deployed before the migration is
  applied. The guarded Neon migration workflows need GitHub dispatch (`gh`) and `psql`; neither is
  available here. `REFERRAL_REWARDS_ENABLED` stays **false** until the migration is applied to the
  production branch, the isolated integration branch is migrated and integration tests pass, and the
  code is deployed (migration first, deploy second).

## Withdrawal system hardening (2026-10-24)
Prepared the existing OxaPay withdrawal system for real production use. `PAYOUTS_ENABLED` remains
`false` pending provider funding/permissions/compliance confirmation.
- **Provider params verified (v1 live):** USDT/BSC `withdraw_min=0.01`, `withdraw_fee=0.25`,
  network `keys=[BSC,BEP20,...]`. Added `getSupportedCurrencies` withdraw fields, a configurable
  `OXAPAY_MIN_PAYOUT_USDT` (default `0.01`) enforced on the **net** amount at request time, and a
  configurable `OXAPAY_PAYOUT_NETWORK` (default `BEP20`). User fee is `0.25 USDT` (equal to the
  0.25 provider fee; no platform margin); gross/fee/net are shown before submit.
- **Uncertain payout results are reconciled, not retried blindly:** a submission that ends in a
  timeout/network/5xx (or malformed response) keeps the deterministic `wd_<id>` anchor and throws
  `payout_uncertain`; a definite 4xx rejection removes the anchor for a corrected retry. New admin
  resolution `POST /api/admin/withdrawals/:id/payout/resolve` (`not_submitted` | `attach_track_id`)
  clears/attaches the anchor after an operator checks OxaPay — audited, never moves funds.
- **Reject is blocked once a payout has been submitted** (prevents releasing locked Earned SP while
  funds are in flight). **Webhook IGNORED recovery** mirrors deposits: a transition recorded
  `IGNORED` and matched to a payout intent can be safely re-evaluated; settlement stays exactly-once
  via guarded status transitions + the SP-ledger unique key.
- **Earned-only accounting preserved:** Bonus SP is never withdrawable; atomic reserve/release via
  `debitEarnedSp`/`creditSp`; one pending request; 24h post-payout cooldown; wallet-change hold.
- **UI:** admin queue shows gross/fee/net, track id, paid time, and Submit/Reconcile/Resolve
  controls; Wallet shows a gross/fee/net breakdown and paid details.
- **Tests:** 8 new unit tests (uncertain classification, anchor retention, definite-rejection
  cleanup, operator resolution, reject-after-submit block, IGNORED recovery, payout minimum, net
  accounting); 3 added isolated integration tests (pending on the disposable Neon branch).
  Unit **260/260**, `tsc` clean, client PWA build clean, `prisma validate` clean.

## Release-candidate hardening (2026-10-23)
- **Three independent, env-gated financial switches, all default disabled** (exact value `"true"` only):
  `PAYMENTS_ENABLED` (external OxaPay deposits + settlement/reconciliation), `PAYOUTS_ENABLED` (payout
  execution), `REFERRAL_REWARDS_ENABLED` (reward crediting). Enforcement re-reads the environment per call.
- **Internal CEO purchases are decoupled from `PAYMENTS_ENABLED`**: purchases spend existing SP
  (Bonus-first, idempotent, transactional) regardless of deposit activation. Only external deposits and
  their webhooks are payments-gated.
- **Payout workflow prepared (disabled by default):** `executeWithdrawalPayout` (idempotent submission via
  a deterministic `PaymentIntent` anchor), `processPayoutWebhook` (confirmed → `PAID`; failed → release
  locked Earned SP + `REJECTED`; duplicate → ignored), and `reconcileWithdrawalPayout` (provider lookup).
  Deposit vs payout callbacks are verified with separate merchant/payout keys. New 24h post-payout
  cooldown on new requests. `PAYOUTS_ENABLED`/`REFERRAL_REWARDS_ENABLED` are no longer hardcoded.
- **Migration workflow guard updated** to assert the env-driven payments gate instead of the old
  hardcoded enabled constant; payout/referral disabled assertions preserved.
- **Emerald Empire design system (player-facing):** CSS-variable design tokens (`theme-emerald` scope:
  bg `#091916`, surface `#122A25`, emerald primary `#10B981`, luxury gold `#D4AF65`, cream ink
  `#F2E9D5`, muted `#A7B9B0`) mapped through Tailwind. The Admin panel retains the default palette
  (`:root` blue tokens unchanged; no `theme-emerald`). Shared UI primitives (card/button/badge/kit),
  player `Layout`, auth/landing, dashboard, market and wallet updated. Plus Jakarta Sans loaded.
- **Withdrawals UI** now reflects the live `payoutsEnabled` flag instead of a hardcoded warning.
- **Withdrawal wallet security (V2.5):** saved BEP20 wallet on `User` (`withdrawalWallet`,
  `withdrawalWalletChangedAt`), configurable change-hold (`WITHDRAWAL_WALLET_HOLD_HOURS`, default 24h),
  wallet changes blocked while a withdrawal is pending, requests must match the saved wallet, and a
  non-sensitive security log on change. Migration `20261023000000_v25_withdrawal_wallet` (additive;
  **authored, NOT applied** — no production DB access).
- **Referral reward activation path:** env-gated `REFERRAL_REWARDS_ENABLED`; exactly-once Bonus-SP
  crediting and refund reversal tested when enabled (single-level only).
- **Emerald theme extended** to auth, legal, and world-map/player panels (gray → semantic tokens).

## Verified current state
- **Repo:** git repository, default branch `master` (V2.5 economy/progression backend, UI redesign,
  migration workflows, plus Steps 1–7: registration, missions, admin/special tasks, admin management,
  referrals, wallet/purchases, and final game UI/UX). Monorepo `client` / `server` / `shared`.
- **Auth (implemented):** register/login/logout/me; JWT httpOnly `token` cookie (7d); bcrypt (12); Zod;
  `/api/auth` rate limit. Username validation matches the approved rule (3–20 chars, `[A-Za-z0-9_]`).
  Email verification/password recovery **deferred** (MVP decision).
- **Registration (V2.5 Step 1, implemented):** confirm-password matching (client), optional **Referral
  Code** auto-populated from `?ref=CODE` and editable, mandatory ToS/Privacy acceptance with working
  `/terms` + `/privacy` pages. Server-side: consent recorded atomically with account creation
  (`PolicyConsent` rows with server-authoritative policy versions + DB acceptance timestamp); referral
  codes validated server-side with **self-referrals rejected** (code cannot equal the new username) and
  valid attribution stored; referral rewards stay **disabled**. New client policy pages use the existing
  responsive dark theme. Migration `20261019000000_v25_registration_policy_consent` (additive
  `PolicyConsent` table) **applied to the isolated test branch and to production** (verified 2026-10-20;
  identity verified, `User` count unchanged).
- **Referral rules (V2.5, documented in Master Spec §0/§8):** 10 Bonus SP per qualified referral; 10%
  recurring commission on every confirmed eligible paid CEO purchase by a referred user; permanent
  attribution; no rewards for self-referrals, duplicate, failed, or refunded purchases. Commission
  currency, qualification criteria, and refund handling remain **unresolved**; rewards stay disabled.
- **CEO catalog API (implemented):** `GET/POST/PUT/DELETE /api/ceos`; Decimal→string serialization;
  active-row reads via `GET /api/ceos?isActive=true`.
- **Ownership backend (implemented, unit + integration tested):** `GET /api/game/ceos/owned`,
  `POST /api/game/ceos/starter`, `POST /api/game/onboarding`; idempotent, concurrency-safe starter.
  Routes are mounted under `/api/game` and align with the client API layer (`client/src/lib/game.ts`).
- **Economy foundation (implemented; migration applied to production):**
  - Separate **Earned SP / Bonus SP** accounts + immutable `SpLedgerEntry` (Bonus spent first).
  - **Lifetime Earned-SP caps** on `OwnedCeo` (archived/`EXHAUSTED` on exhaustion).
  - **Equipment** tiers Standard 4h / Extended 6h (500 SP) / Advanced 8h (1,500 SP), SP-priced, level-gated.
  - **Production cycles**: `POST /api/game/ceos/:id/start`, `/collect`, `/equipment`, `/bulk-start`,
    `/bulk-collect`; server-authoritative, snapshot reward, exactly-once claim, concurrency guards.
  - **XP/levels/ranks** (`ProgressAccount`, approved formula, 224,420 XP to level 50) and `GET /resources`,
    `GET /sp/ledger`.
  - Pure game math in `server/src/lib/gameMath.ts`.
- **Progression & retention (implemented; migration applied to production):**
  - **Daily/weekly tasks** via an append-only `TaskEvent` log + idempotent `TaskClaim`; approved XP values
    (165 XP/day, 1,250 XP/week), UTC 00:00 / Monday-00:00 periods, manual Claim / Claim All.
    **Step 2 hardening:** the board now returns per-task `claimed` state; Claim / Claim All are
    concurrency-safe (per-user `pg_advisory_xact_lock` + P2002 catch) and return the refreshed board so
    the UI updates in one round trip; duplicate/already-claimed claims are idempotent successes.
  - **Achievements**: 5 tracks × 4 stages, derived lifetime counters, XP-only one-time claims.
  - **Leaderboard + public profiles** (`/api/public/leaderboard`, `/api/public/profile/:username`; no
    private data) + featured badges/avatar (`UserProfile`).
  - **Referral rewards**: rules/amounts present (10 Bonus SP, 10% commission) but **disabled**
    (`REFERRAL_REWARDS_ENABLED=false`) pending approved qualification.
  - **Withdrawal request/review states** (gross Earned-SP lock, min 1,000 SP, 0.25 USDT fee) with
    **payouts disabled**; admin review queue never transfers crypto.
- **Admin foundation + special tasks (V2.5 Step 3, implemented):**
  - **Admin authz**: `/api/admin/*` is server-guarded by `requireAuth` + `requireAdmin`; there is **no
    public admin registration** (registration always creates `USER`; admins are provisioned out-of-band).
  - **Admin console UI** at `/admin` (client-guarded + API-guarded): dashboard, special-task management,
    and audit log. Player layout exposes an "Admin console" link only when `role === 'ADMIN'`.
  - **SpecialTask** campaigns: title, description, link, proof instructions, XP and/or Bonus SP reward,
    verification mode (MANUAL/AUTO), minimum level, optional max completions (participant cap), start/expiry
    windows; lifecycle DRAFT → PUBLISHED → PAUSED/EXPIRED → ARCHIVED.
  - **Submissions**: `SpecialTaskSubmission` with states PENDING/APPROVED/REJECTED/CLAIMED and a
    `claimedAt`; up to 3 proof attempts; slot reserved at first submission and released on final rejection.
  - **Exactly-once rewards**: claim uses an `APPROVED → CLAIMED` conditional transition; Bonus SP goes
    through the existing `SpLedgerEntry` with `sourceType=SPECIAL_TASK_REWARD` and `sourceId=submissionId`
    (unique backstop); XP via `awardXp`. Server-authoritative; no payment/referral activation.
  - **Audit + abuse protection**: every admin mutation writes an `AdminAuditLog` row; unusually high
    rewards (> 5,000 XP or Bonus SP) require explicit confirmation; submit endpoint is rate-limited (15/min).
  - **Player UI**: a **Special Tasks** panel is the first section on the Missions page with clear states
    (Available, Pending, Approved/ready-to-claim, Completed, Rejected, Expired, Locked, Full).
- **Admin management (V2.5 Step 4, implemented):**
  - **User management**: search + account detail (balances, XP/level/rank, owned CEOs, referrals,
    SP ledger, withdrawals, production); **suspend/reactivate** with explicit confirmation and audit.
  - **Suspended users are blocked** from all protected `/api/game` + `/api/admin` routes (403
    `account_suspended`) and from login; suspension is checked server-side in `requireAuth`.
  - **CEO catalog management**: list all tiers; edit presentation/visibility/sales only
    (name, rarity, category, displayOrder, imageUrl, isActive, isForSale); economy/production fields are
    rejected by a `.strict()` schema. New tiers are created **hidden + not-for-sale** pending owner
    governance; deletion is **blocked while copies are owned** (`owned_exists`).
  - **Economy monitoring**: aggregate Earned/Bonus/lifetime SP, ledger by source, production/ownership
    stats, and a suspicious-activity watch (large credits, high cycle volume).
  - **Withdrawal review**: inspect and approve/hold/reject internally (payouts disabled); every decision
    is audited. **Site settings**: registration availability, maintenance mode, feature visibility, and a
    public announcement banner (stored in `AppMeta`).
  - **Enforcement**: registration/maintenance gating in `/api/auth/register` and `requireAuth`;
    `GET /api/public/settings` exposes the public-safe settings (announcement + feature flags), consumed by
    the player layout for the banner and nav feature visibility.
  - **Audit + confirmation**: all admin mutations write `AdminAuditLog`; sensitive actions (suspension,
    settings, catalog create/delete) require an explicit `confirm` flag.
  - Migration `20261019030000_v25_admin_management` (additive columns: `User.isSuspended/suspendedAt/
    suspensionReason`, `CEO.imageUrl/isForSale`) **applied to the isolated test branch and to production**
    (verified 2026-10-20).
- **Referral system (V2.5 Step 5, implemented):**
  - **Attribution**: referral codes captured at registration and permanently associated (`ReferralAttribution`,
    unique referred user); self-referrals and duplicate attribution rejected; salted IP/user-agent
    **fingerprints** stored for abuse detection; legacy `eligible` backfilled into a new `status`.
  - **Qualification states**: `PENDING → QUALIFIED/REJECTED/REVOKED` with admin review (confirm + audit).
  - **Rewards**: the approved **10 Bonus SP** per qualified referral is recorded as a `ReferralReward`
    (kind `REGISTRATION_BONUS`, unique/idempotent); recurring **10% commission** (`PURCHASE_COMMISSION`)
    is prepared via `ReferralPurchaseEvent`. **Rewards remain DISABLED** (`REFERRAL_REWARDS_ENABLED=false`);
    records are created `PENDING` and are **not** credited to the ledger.
  - **Configurable but disabled**: commission currency, registration bonus, bps and qualification criteria
    live in site settings (`referral.*`) for review; the master switch is a code constant and cannot be
    enabled until the owner approves the unresolved economics.
  - **Payments safety**: `recordReferralPurchaseEvent` is idempotent on `purchaseRef` and reverses
    commission on refund/chargeback; failed/duplicate events never earn.
  - **Player page** `/dashboard/referrals`: code, shareable link, totals, qualified, pending/paid rewards,
    qualification criteria, and referral history. **Admin** `/admin/referrals`: review queue, abuse flags,
    commission/reward records, audit.
   - Migration `20261019040000_v25_referral_system` (ReferralReward + ReferralPurchaseEvent + status columns
     + 4 enums) **applied to the isolated test branch and to production** (verified 2026-10-20).
- **Wallet + CEO purchases (V2.5 Step 6, implemented):**
  - **Wallet** `/api/game/wallet` + `/api/game/wallet/transactions`: Earned/Bonus SP, **USDT** (confirmed
    deposits − paid-out; `0.00` while disabled — never simulated), pending-withdrawal lock, and a merged
    newest-first transaction history (SP ledger + deposits + withdrawals + purchases).
  - **CEO purchases**: `CeoPurchase` records with server-validated catalog price (`priceUsdSnap`),
    idempotency key, and **exactly-once ownership delivery** (guarded `PAID → DELIVERED` + unique
    `ownedCeoId`); delivery creates an `OwnedCeo` (`PURCHASE`) and links the confirmed purchase to the
    referral purchase-event pipeline (`purchase:<id>`, commissions disabled).
  - **Payments prepared, not activated**: `PaymentIntent` invoices (OxaPay, externalId), idempotent
    `PaymentWebhookEvent` log, and `confirmDepositIntent` crediting **Bonus SP** exactly once via the SP
    ledger (`DEPOSIT_CREDIT`). All gated by `PAYMENTS_ENABLED=false`; deposit/purchase/webhook flows are
    inert (503 / ignored) and never credit.
  - **Admin** `/admin/payments`: view payment intents (deposits) and CEO purchases; existing withdrawal
    review unchanged. **Client**: Wallet shows USDT/deposits/purchases/transactions; Market exposes a
    server-validated Buy action that reports payments are disabled.
   - Migration `20261019050000_v25_wallet_purchases` (PaymentIntent / PaymentWebhookEvent / CeoPurchase +
     4 enums + `SpSourceType.DEPOSIT_CREDIT`) **applied to the isolated test branch and to production**
     (verified 2026-10-20).
- **Final game UI/UX (V2.5 Step 7, client-only):**
  - **Brand identity**: shared `Logo`/`LogoMark` component (SVG `icon.svg` + `favicon.svg`), used across
    Landing/Login/Register/player shell/admin shell; unified PWA manifest (`manifest.webmanifest` +
    `public/manifest.json`) with refined name/description and SVG + maskable PNG icons; `viewport-fit=cover`.
  - **Empire map**: `/dashboard/world` is now reachable from the nav ("Empire Map"); four visually distinct
    isometric buildings (HQ / Data / Labs / Tower) with upgrade-state ring/glow, level pips, a color legend
    and a live HUD (real level/XP/SP via `useResources`; no energy). Tap-to-inspect building panel shows
    level pips and upgrading state.
  - **CEO cards & feedback**: live per-second production countdowns, pulsing "Ready to collect" state, and
    success toasts on start/collect/bulk/equip actions (Home).
  - **Page polish**: Achievements surfaces claimable count + claim error feedback; Leaderboard highlights
    the top-3 podium; Wallet/Missions/Referrals retain their existing loading/empty/error states.
  - **Consistency**: reused existing components/tokens; **no backend, schema, economy, price or reward
    changes**; admin panel unchanged (only the brand mark).
- **Production database (verified 2026-10-20, read-only):** production branch
  `br-delicate-butterfly-b4et73g9` / project `wandering-king-57462138` / database `neondb` has **all 11
  `_prisma_migrations` rows finished** with none incomplete/failed: the four baseline migrations, both
  earlier V2.5 migrations (`20261018000000_v25_economy_sp_production`, `20261018010000_v25_progression`),
  and the five V2.5 Step migrations (`20261019000000_v25_registration_policy_consent`,
  `20261019020000_v25_special_tasks`, `20261019030000_v25_admin_management`,
  `20261019040000_v25_referral_system`, `20261019050000_v25_wallet_purchases`). All corresponding
  tables/columns/enums verified present (PolicyConsent; SpecialTask/SpecialTaskSubmission/AdminAuditLog;
  User suspension + CEO imageUrl/isForSale; ReferralReward/ReferralPurchaseEvent + status columns;
  PaymentIntent/PaymentWebhookEvent/CeoPurchase + `SpSourceType.DEPOSIT_CREDIT`). Catalog shows **8 active
  CEO tiers** (10 rows total; `crypto-whale` and `test-ceo` inactive); `User=3` / `CEO=10` preserved.
  **The V2.5 migration execute workflows (economy/progression and Steps 1/3/4/5/6) must NOT be dispatched
  again** — every migration is already recorded; a re-dispatch is refused by their pre-checks and is
  unnecessary.
- **UI redesign (V2.5):** new design system (tokens, glass panels, animations), app shell with sidebar +
  mobile bottom nav, and API-connected pages: Landing (marketing), Home (production: start/collect/bulk,
  equipment, lifetime caps, archived state), Market (active tiers), Collection (owned fleet), Tasks
  (daily/weekly + Claim All), Achievements, Leaderboard + public profiles, Profile (referrals, featured
  badges), Wallet (balances, SP ledger, withdrawal requests with payouts disabled). Legacy demo pages
  removed. Client API layer in `client/src/lib/game.ts`.
- **Tests:**
  - `npm test --workspace=server` — **148/148 unit pass** (incl. Step 6 USDT↔SP conversion/status
    transitions and payments/purchases exactly-once/idempotency/wallet tests, plus all prior suites).
  - `npm run test:integration --workspace=server` — **8/8 pass** against isolated branch
    `br-floral-resonance-b4ruvusw` (identity-guarded + schema-guarded incl. Steps 3–6 tables and Step 4 CEO
    columns; ownership + production start/collect, duplicate-collection prevention, lifetime-cap exhaustion).
  - `npm run test:smoke --workspace=server` — **71/71 pass** (HTTP end-to-end against the isolated
    branch; adds Step 6 flows: wallet summary/UTXO=0, deposits/purchases disabled 503, inert webhook,
    admin payments/purchases lists; plus Steps 2–5 assertions).
  - Integration/smoke self-skip when `TEST_DATABASE_URL` is unset and refuse to run against protected
    (production/staging/recovery) branches.
  - Re-verified 2026-10-19 after applying the Step 6 migration to the isolated branch: unit **148/148**,
    integration **8/8** and smoke **71/71** (wallet/purchase flows; smoke resets site settings and cleans
    up `PolicyConsent`, `SpecialTask`, `AdminAuditLog`, referral attributions/rewards, purchase/intent rows
    and `itest_smoke_` webhook events).
- **Builds:** server `tsc` typecheck **passes**; client production PWA build **passes** (workbox precache
  limit raised).

## Docs layout (reconciled 2026-10-18)
- `docs/TYCOONX_V2_MASTER_SPEC.md` — canonical product rules.
- `docs/PROGRESS.md` — this file.
- `docs/ARCHITECTURE.md` — current system map.
- `docs/archive/` — superseded docs retained for reference (see `docs/archive/README.md`).

## Blockers (owner action required)
1. **Resolved: all V2.5 migrations applied.** Both earlier V2.5 migrations and the five V2.5 Step
   migrations are recorded applied on production (see Verified current state). No re-apply is needed; the
   execute workflows are fail-closed against a second apply and **must not be dispatched again**.
2. **Execution workflows** (`neon-migration-preflight.yml`, `neon-migration-execute.yml`,
   `neon-migration-execute-steps.yml`) remain the standard guarded production path: branch/project
   identity, frozen checksums, confirmation token, single-transaction applies, history recording, final
   verification. **Do not re-dispatch any of them for the current migration set** — all 11 migrations are
   already recorded on production and their pre-checks are fail-closed; dispatch only when a genuinely new
   migration is added.
3. **Backup/PITR gate** should be confirmed with the owner for any future migration window (no Neon API
   credential is available here).
4. **Application deployment not configured.** No hosting/deployment config exists in the repository; the
   server and client are not deployed by any tracked config. Production currently means the migrated
   database only.
5. **Payments disabled.** OxaPay is planning only; deposits, withdrawals, payouts and referral rewards
   remain **disabled** pending owner approval and go-live gates.
6. **Resolved: registration consent migration applied to production.** `20261019000000_v25_registration_policy_consent`
   (additive `PolicyConsent` table) is verified applied on production (`br-delicate-butterfly-b4et73g9`,
   `finished_at` set, no incomplete rows). Registration records consent in the same transaction as the
   account, and the table now exists in production. No further migration action.
7. **Referral economics unresolved (owner action).** Before referral rewards can be activated, the owner
   must confirm: the **commission currency**, the **qualification criteria**, and **refund/chargeback
   handling**. Rewards stay disabled (`REFERRAL_REWARDS_ENABLED=false`) until then.
8. **Resolved: special tasks migration applied to production.** `20261019020000_v25_special_tasks`
   (additive `SpecialTask` / `SpecialTaskSubmission` / `AdminAuditLog` tables + 3 enums) is verified
   applied on production. Admin/special-task endpoints no longer fail closed for missing tables. No
   further migration action.
9. **Resolved: admin management migration applied to production.** `20261019030000_v25_admin_management`
   (additive columns `User.isSuspended/suspendedAt/suspensionReason` and `CEO.imageUrl/isForSale`) is
   verified applied on production. Admin user/catalog/settings endpoints no longer fail closed for missing
   columns. No further migration action.
10. **New-tier governance (owner action).** Admin-created CEO tiers are forced hidden/not-for-sale on
    creation; activating a new tier with production values is an economy decision that requires owner
    approval before it is made visible/for-sale.
11. **Resolved: referral migration applied to production.** `20261019040000_v25_referral_system`
    (additive `ReferralReward` / `ReferralPurchaseEvent` tables, `ReferralAttribution` status/fingerprint
    columns, 4 enums; legacy `eligible` backfilled) is verified applied on production. Referral endpoints
    no longer fail closed for missing columns/tables. No further migration action.
12. **Referral economics still unresolved (owner action).** Rewards remain **disabled**
    (`REFERRAL_REWARDS_ENABLED=false`, authoritative code constant). Before activation the owner must
    confirm: the **commission currency**, the **qualification criteria**, and **refund/chargeback
    handling**. Records are created PENDING and never credited until then.
13. **Resolved: wallet/purchases migration applied to production.** `20261019050000_v25_wallet_purchases`
    (additive `PaymentIntent` / `PaymentWebhookEvent` / `CeoPurchase` tables, 4 enums,
    `SpSourceType.DEPOSIT_CREDIT`) is verified applied on production. Wallet/purchase endpoints no longer
    fail closed for missing tables. No further migration action.
14. **Payments not activated (owner action).** `PAYMENTS_ENABLED=false` is authoritative: deposits,
    purchases, webhooks and payouts are inert (no invoice is created, nothing is credited, no CEO is
    delivered). Before activation the owner must complete the §9 OxaPay go-live gates (provider approval,
    KYC/AML, fees/minimums, controlled end-to-end tests, reconciliation). Deposits credit **Bonus SP**
    (non-withdrawable) as a documented safe default pending owner confirmation.

## Not implemented yet (see Master Spec §0/§3–§9)
**OxaPay** integration (planning only, not activated); real-money purchases/deposits/withdrawals/payouts;
application (server/client) deployment.

## Next
1. Documentation reconciliation — **done**.
2. Economy foundation + production-cycle engine + XP/levels — **done (unit + integration tested; migration applied)**.
3. Tasks, achievements, leaderboard, public profiles, referral rewards, withdrawal requests — **done**.
4. Catalog mapping + full UI redesign wired to real APIs — **done**.
5. Production migration execution — **done** (all 11 migration records applied, incl. the five V2.5 Step migrations; verified 2026-10-20).
6. **Remaining:** application deployment (server + client hosting) and admin UI are not configured;
   OxaPay integration and all real-money flows stay disabled pending explicit owner approval.
7. **V2.5 Step 1 (registration) — done and branch-verified.** Confirm password, referral prefill/manual
   entry, ToS/Privacy consent + pages, server-side referral validation and consent recording. Unit
   **148/148**, integration **8/8**, smoke **71/71** (consent migration applied to the isolated test branch
   only). Production application of the migration and the unresolved referral rules below remain owner
   decisions.
8. **V2.5 Step 2 (missions & rewards) — done.** See "Missions — Step 2 fixes" below.
9. **V2.5 Step 3 (admin foundation + special tasks) — done.** See "Special Tasks — Step 3" below.
10. **V2.5 Step 4 (admin management) — done.** See "Admin Management — Step 4" below.
11. **V2.5 Step 5 (referral system) — done.** See "Referral System — Step 5" below.
12. **V2.5 Step 6 (wallet + CEO purchases) — done.** See "Wallet + Purchases — Step 6" below.
13. **V2.5 Step 7 (final game UI/UX) — done.** See "Game UI/UX — Step 7" below.

## Game UI/UX — Step 7 (2026-10-19)
Client-only polish (no backend/economy/schema changes):
1. **Brand identity**: shared `Logo`/`LogoMark` (SVG icon + favicon) across auth, player and admin shells;
   unified PWA manifest with SVG + maskable PNG icons and refined metadata.
2. **Empire map**: reachable via nav; four distinct isometric buildings with upgrade states, level pips and
   a legend; live HUD using real level/XP/SP (energy removed).
3. **CEO cards/timers/feedback**: per-second countdowns, pulsing ready state, and action success toasts.
4. **Page polish**: Achievements claim feedback + claimable count; Leaderboard podium tint.
5. **Consistency/mobile**: reused existing components/tokens; responsive layouts and empty/loading/error
   states retained; admin panel unchanged apart from the brand mark.

Verification: client PWA build passes (server untouched; unit/integration/smoke unaffected). No financial
logic, schema, prices, rewards or production rules changed.

## Wallet + Purchases — Step 6 (2026-10-19)
Extended the existing wallet/ledger/admin systems (no rebuild) with:
1. **Wallet**: Earned/Bonus SP, **USDT** (confirmed deposits − paid-out; 0.00 while disabled), pending
   withdrawal lock, and merged transaction history; deposit/withdrawal request states.
2. **CEO purchases**: server-validated catalog price, `CeoPurchase` records, and **exactly-once ownership
   delivery** (guarded `PAID → DELIVERED` + unique `ownedCeoId`).
3. **Payment invoices + webhook prep**: `PaymentIntent` (OxaPay externalId) and idempotent
   `PaymentWebhookEvent`; `confirmDepositIntent` credits Bonus SP exactly-once via the SP ledger.
4. **Admin**: `/admin/payments` lists payment intents and purchases; withdrawal review unchanged.
5. **Idempotency/atomicity**: idempotency keys, guarded conditional transitions, unique indexes, single
   transactions; no duplicate credits/purchases/delivery.
6. **Referral linkage**: confirmed purchases call the Step 5 purchase-event pipeline (`purchase:<id>`);
   commissions remain disabled.
7. **All financial actions disabled**: `PAYMENTS_ENABLED=false` gates deposit/purchase creation (503) and
   webhooks (recorded + ignored); USDT balance is real (never simulated).

Verification: unit **148/148**, integration **8/8**, smoke **71/71**; server `tsc` and client PWA build pass.
Migration `20261019050000_v25_wallet_purchases` applied to the isolated test branch and to **production** (verified 2026-10-20). No payments,
payouts, referral rewards or economy rules activated.

## Referral System — Step 5 (2026-10-19)
Extended the existing referral system (no rebuild) with:
1. **Dedicated player page** `/dashboard/referrals`: referral code, shareable link, total + qualified
   referrals, pending/paid reward SP, qualification criteria, and referral history.
2. **Automatic capture**: referral codes captured at registration and permanently associated via a unique
   `ReferralAttribution`; self-referrals and duplicate attribution rejected.
3. **Explicit states**: `PENDING → QUALIFIED/REJECTED/REVOKED` with admin review; abuse detection via
   salted IP/user-agent fingerprints and a shared-IP flag.
4. **10 Bonus SP reward** recorded exactly-once (`ReferralReward`, `REGISTRATION_BONUS`).
5. **Recurring 10% commission prepared** (`PURCHASE_COMMISSION`) via `ReferralPurchaseEvent`.
6. **Configurable but disabled**: commission currency / qualification stored in site settings; the master
   switch is the `REFERRAL_REWARDS_ENABLED=false` code constant — nothing is credited.
7. **Admin management** `/admin/referrals`: review queue, abuse flags, commission/reward records + audit.
8. **Refund/chargeback/failed/duplicate safety**: `recordReferralPurchaseEvent` is idempotent on
   `purchaseRef`; reversals reverse the commission; failed/duplicate never earn.
9. **Tests**: pure qualification/commission tests, service idempotency + concurrent-qualify + reversal
   tests, and smoke coverage of referred registration → summary → admin review → qualify → pending reward.

Verification: unit **132/132**, integration **8/8**, smoke **62/62**; server `tsc` and client PWA build pass.
Migration `20261019040000_v25_referral_system` applied to the isolated test branch and to **production** (verified 2026-10-20). Rewards,
payments and referral payouts remain **disabled**; CEO prices/production rates unchanged.

## Admin Management — Step 4 (2026-10-19)
Extended the existing `/admin` panel (no rebuild) with:
1. **User management**: search, account detail (balances, XP/level/rank, owned CEOs, referrals, SP ledger,
   withdrawals, production), and suspend/reactivate with explicit confirmation + audit.
2. **Suspension enforcement**: `requireAuth` blocks suspended accounts on all protected routes (403
   `account_suspended`) and login is blocked too; verified in smoke.
3. **CEO catalog management**: list + edit presentation/visibility/sales; `.strict()` schema rejects
   economy/production fields so approved parameters cannot change; create is hidden/not-for-sale pending
   governance; delete is blocked while copies are owned (`owned_exists`).
4. **Economy monitoring**: aggregate SP totals, ledger by source, production/ownership stats, and a
   suspicious-activity watch (large credits, high cycle volume).
5. **Withdrawal review**: approve/hold/reject internally (no payouts) with audited decisions.
6. **Site settings**: registration availability, maintenance mode, feature visibility, public
   announcement; stored in `AppMeta`; enforced in register + `requireAuth`; exposed via
   `GET /api/public/settings` and surfaced in the player layout (banner + nav visibility).
7. **Authorization/validation/audit/confirmation**: `requireAuth`+`requireAdmin`, Zod validation,
   `AdminAuditLog` on every mutation, explicit `confirm` for sensitive actions.

Verification: unit **116/116**, integration **8/8**, smoke **55/55**; server `tsc` and client PWA build pass.
Migration `20261019030000_v25_admin_management` applied to the isolated test branch and to **production** (verified 2026-10-20). No payments or
referral rewards activated; economy rules unchanged (production/economy fields are not editable).

## Special Tasks — Step 3 (2026-10-19)
Delivered admin foundation and admin-created special tasks with exactly-once rewards:
1. **Secure `/admin`**: all `/api/admin/*` routes use `requireAuth` + `requireAdmin` (role read from the DB,
   not the token); the client routes are gated on `role === 'ADMIN'` and redirect otherwise. **No public
   admin registration exists** — registration always creates `USER`; admins are provisioned out-of-band.
2. **Admin console** (`/admin`): layout + dashboard (campaign/submission/user counts, recent audit),
   campaign management, and an audit-log viewer.
3. **Campaign lifecycle**: create/edit/publish/pause/expire/archive with legal-transition enforcement;
   rewards are snapshot-immutable once a submission exists.
4. **Configurable fields**: title, description, link, proof instructions, XP and/or Bonus SP reward,
   verification mode, minimum level, max completions (participant cap), start/expiry windows.
5. **Player flow**: special tasks appear as the **first section** of the Missions page; submission →
   verification → approval/rejection → manual claim.
6. **States**: Available, Pending, Approved (ready to claim), Completed, Rejected (retryable up to 3),
   Expired, plus Locked/Full. Server derives state from `derivePlayerState`.
7. **Exactly-once rewards**: approval and claim are guarded by conditional status transitions
   (`PENDING→APPROVED`, `APPROVED→CLAIMED`); Bonus SP uses `SpLedgerEntry` (`SPECIAL_TASK_REWARD`,
   `sourceId=submissionId`) with its unique key as a second backstop; XP uses `awardXp`.
8. **Abuse protection + audit**: per-user submission rate limit, 3-attempt cap, single pending submission,
   slot reservation/release, and an `AdminAuditLog` row per admin mutation; high rewards require
   confirmation.
9. **Tests**: unit coverage for lifecycle, submission, duplicate/concurrent approvals, concurrent claims,
   eligibility, caps, snapshot immutability, and reward correctness; smoke coverage for non-admin 403,
   create/publish, submit, duplicate-submit rejection, approve, exactly-once claim, and audit.

Verification: unit **99/99**, integration **8/8**, smoke **40/40**; server `tsc` and client PWA build pass.
Migration `20261019020000_v25_special_tasks` applied to the isolated test branch and to **production** (verified 2026-10-20). No payments or
referral rewards were activated; daily/weekly missions and economy rules are unchanged.

## Missions — Step 2 fixes (2026-10-19)
Reported bug: **Claim did not reliably change to Done.** Root causes and fixes:
1. **No claimed state was surfaced.** `GET /api/game/tasks` only returned `completed` (derived from
   events), never the `TaskClaim` rows. After claiming, `completed` stayed true, so the button never
   changed and a second click hit a 409. Fix: `computeTaskBoard` now takes the user's claims and returns
   a `claimed` flag per task/bonus (`server/src/lib/tasks.ts`, `services/tasks.ts`).
2. **Concurrent duplicate claims raised an unhandled unique violation (P2002) → 500/hang.** Fix: claim
   writes are serialized per user with `pg_advisory_xact_lock` inside the transaction, plus a defensive
   P2002 catch that reports "already claimed" instead of erroring (`services/tasks.ts`). Uses
   `$executeRaw` (not `$queryRaw`) to avoid deserializing the lock's `void` result.
3. **Task/achievement routes had no async error handling.** Fix: try/catch with explicit status codes;
   already-claimed is a **200 success** (idempotent), only truly incomplete tasks are 409
   (`routes/game/progression.ts`).
4. **UI could not show Done / distinguish already-claimed / update immediately.** Fix: `Tasks.tsx` now
   tracks claimed state from the server-returned board, updates state from the claim response (no page
   refresh), shows per-task loading, success/info/error notices, and disables claimed buttons ("Done").
   Claim All returns the refreshed board and is disabled when nothing is claimable.
5. **XP balance did not refresh.** Fix: new `client/src/lib/resources.ts` (`useResources` +
   `notifyResourcesChanged`) so a shared resources view (Tasks XP stat, Layout, Home, Profile, Wallet)
   refetches immediately after a claim.
6. **Reset/availability verified** by regression tests: stale previous-period claims never leak into the
   current board; current-day/week completion is unchanged.

Verification: unit **78/78**, integration **8/8**, smoke **28/28** (isolated branch only); server `tsc`
and client PWA build pass. No schema/migration change and no economy/reward value was altered.

Remaining (out of Step 2 scope): Special Tasks (Step 3); admin UI; application deployment.


## Registration — remaining requirements before production-ready
Registration code and schema are complete and verified on the isolated branch. It is **not production-ready**
until the following owner/environment actions are completed (none are code bugs):
1. **Migration `20261019000000_v25_registration_policy_consent` applied to production** (verified
   2026-10-20). The consent write is inside the account-creation transaction; the `PolicyConsent` table
   now exists in production, so registration no longer fails closed for a missing table.
2. **Legal review + owner sign-off on the Terms of Service and Privacy Policy text** (currently concise
   product summaries at `/terms` and `/privacy`, version `1.0`, effective `2026-10-19`). Bump the policy
   versions in `server/src/lib/policies.ts` and the client policy pages if the text changes.
3. **Owner confirmation of the unresolved referral economics** (commission currency, qualification
   criteria, refund/chargeback handling) and approval of anti-abuse rules; rewards stay disabled until
   then. No referral rewards are granted at registration.
4. **Confirm the `consent` data-retention / privacy handling** (audit rows use `ON DELETE RESTRICT`) with
   the owner and, if required, an applicable data-minimization policy.
5. **Application deployment not configured** — the server and client are not hosted by any tracked config;
   production currently means the migrated database only.
