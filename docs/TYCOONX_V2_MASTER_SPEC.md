# TycoonX V2 — Master Product Rules & OpenCode Build Charter

**Version:** 2.5 (owner-approved) — 2026-10-18  
**Purpose:** Canonical single product-rules source of truth for the TycoonX V2.5 MVP and the existing repository.  
**Status:** This file is the canonical product specification. Owner-confirmed V2.5 decisions are listed in §0 and override any conflicting line below and any older document. Choices labeled **V2.4 implementation defaults** are recommendations, not financially validated. All previously approved economic parameters remain unchanged unless re-stated in §0.  
**Priority:** Owner-approved decisions (§0 and this prompt) > this Master Spec > existing implementation > historical documentation (reference only). Stop and report genuine conflicts before changing financial logic. Never silently rewrite old docs or deploy payment flows.

## 0. Owner-confirmed V2.5 MVP decisions (authoritative)
- **Conversion:** 1 USDT = 1,000 SP.
- Eight CEO tiers with the prices, production rates, and **finite lifetime Earned-SP caps** defined in §3. **Unlimited CEO copies per account.** Exhausted copies are permanently **archived** (ownership retained).
- Independent **manual** production cycles. Equipment durations: **Standard 4h / Extended 6h / Advanced 8h**. Equipment upgrades cost SP and preserve the underlying **hourly** production rate.
- Separate **Earned SP**, **Bonus SP**, and **XP**. Bonus SP is non-withdrawable and spent first where eligible.
- **Energy and Tech Parts are removed from the MVP economy.** Buildings, projects, and employees remain **Coming Soon**.
- Qualified referrals may receive **10 Bonus SP**; every confirmed eligible paid CEO purchase by a referred user may generate a **10% recurring commission**, subject to approved qualification and anti-abuse protections. Referral attribution is **permanent**; no rewards for self-referrals, duplicate, failed, or refunded purchases. The **commission currency, qualification criteria, and refund handling remain unresolved**. Referral payouts stay **disabled until qualification criteria are approved**.
- **Email verification and email-based password recovery are deferred** for the MVP (supersedes §4). Registration = username + email + password with immediate gameplay. Keep auth extensible for future verification/recovery. Do not issue referral rewards solely for creating an account.
- **Real-money withdrawals remain disabled** until suitable account-recovery, verification, and withdrawal-security measures are implemented and approved. Preserve approved withdrawal minimums, conversion rates, fees, and restrictions (§9).
- **OxaPay** remains the selected future gateway (planning/testing only; not activated). Credentials server-side; callbacks verified; no duplicate credits or payouts.
- **Owner grants full visual/UX/design authority** (§10). The existing UI is not a constraint.
- Do not invent new financial rewards, production multipliers, or CEO earning rates.

## 1. Product and launch scope
Mobile-first English-first PWA: a playful technology-company tycoon, not a finance dashboard. Localizable architecture. Launch: authentication, CEO collection/production, balances, tasks, achievements, global XP leaderboard, public profiles, referrals, admin and withdrawal-request workflow. Show Tech Empire/buildings/projects/staff as **Coming Soon** only. No functioning buildings, project rewards, or staff mechanics at launch. Do not imply those future systems are active XP sources.

## 2. Currency, ledger and spending
- Internal denomination: **1 USDT = 1,000 SP**. Maintain separate **Earned SP** (only CEO-produced and potentially withdrawable), **Bonus SP** (non-withdrawable), **XP** (nonfinancial), and locked/reserved funds. Do not merge into a single withdrawable balance.
- Bonus SP from eligible referral/special-task/deposit-related bonuses; spend Bonus SP first on eligible in-game purchases, then Earned SP only if the purchase type allows it. Equipment uses SP and is eligible for both, Bonus first. Never allow SP or XP earned from tasks to become withdrawable through purchase/refund paths.
- All accounting, cap updates, purchase debits, reward claims and withdrawals are **server-authoritative, transactional, idempotent and auditable**. Use integer smallest units or exact decimal arithmetic; no floating-point money calculations.
- The accounting conversion is a game rule, **not** proof of available payout funds, guaranteed returns, or legal approval.

## 3. CEO copies and equipment
Every verified player receives one free **Intern** CEO copy. Other CEO copies are bought with USDT, owned permanently, unlimited copies under current product rules. Each copy has a finite lifetime Earned-SP production cap, archived when exhausted; ownership remains. Each copy independently starts Idle with Standard equipment. Manual Start / Collect; free bulk Start All / Collect All; no auto-restart. Finished cycles do not produce further until collected and restarted. Offline elapsed time counts only up to the selected cycle's end. A CEO may participate in future projects without affecting production. Equipment is permanently assigned to the specific CEO copy, not a reusable inventory item.

| CEO | Price USDT | Nominal SP / 24h continuous running | Lifetime cap SP / copy |
|---|---:|---:|---:|
| Intern | Free | 120 | 500 |
| CEO 2 | 0.99 | 600 | 1,200 |
| CEO 3 | 4.99 | 2,166 | 6,500 |
| CEO 4 | 19.99 | 9,333 | 28,000 |
| CEO 5 | 49.99 | 18,750 | 75,000 |
| CEO 6 | 99.99 | 40,000 | 160,000 |
| CEO 7 | 249.99 | 90,000 | 450,000 |
| CEO 8 | 999.99 | 400,000 | 2,000,000 |

> **Production-authoritative (2026-10-27):** the nominal SP/24h rates and the Intern lifetime cap above
> are the values configured in the production Neon CEO catalog and supersede the earlier owner-approved
> table. Prices and premium lifetime caps are unchanged. The already-applied migration
> `20261018000000_v25_economy_sp_production` still embeds the *earlier* rates, so a freshly seeded
> (non-production) database will diverge from production until a separate, additive rate-sync migration is
> approved and run; **do not** edit that applied migration or re-run it against production. CEO cycle
> duration is unchanged (`CEO.cycleHours = 4`; equipment durations remain Standard 4h / Extended 6h /
> Advanced 8h) — only the per-24h rates and the Intern cap changed.

**Equipment — V2.4 implementation defaults (previously proposed):** Standard 4h/free/level 1; Extended 6h/500 SP/unlock player level 5; Advanced 8h/1,500 SP/unlock player level 12. Upgrade a CEO copy once per tier; charge only for the selected new equipment (no trade-in, no repeat purchase); selecting equipment applies to **future** cycles, not an active cycle. Hourly production rate is unchanged: longer cycles yield proportionally more SP **per collection**, not more SP per hour; never exceed lifetime cap. The last cycle pays at most remaining cap; if remaining cap is lower than a full cycle, collect only that remainder and archive. The paid equipment's SP sink must not change the Earned SP production rate or create Earned SP. Use precise fractional accrual with deterministic rounding and cap enforcement. Do not advertise nominal daily production as guaranteed earnings.

## 4. Accounts and sessions
- Username/email/password only. **MVP decision: email verification and email-based password recovery are deferred**; gameplay, CEO issuance, production and (once qualification is approved) referral rewards do not require a verified email in the MVP. Design the account model so verification (24h one-time link, resent tokens revoke older ones, rate-limited) and password reset (30m one-time link, resets invalidate all sessions) can be enabled later without schema breakage. No account-enumeration leaks.
- Username permanent, unique case-insensitively, ASCII `[A-Za-z0-9_]`, 3–20 characters. Reserve deleted usernames subject to privacy law/data minimization. Multiple devices allowed; sessions up to 30 days with secure renewal and absolute lifetime. Secure, HttpOnly, SameSite cookies and CSRF protection as appropriate. Logout current device. Progressive login throttling by IP/account; no permanent lockout.
- Active-sessions UI, TOTP 2FA, and email confirmation per withdrawal are deferred. Free predefined avatars, freely changeable; no image uploads. **OpenCode chooses visual style**.

## 5. XP, levels, ranks and leaderboard
- XP to advance L -> L+1: `100 + 25*(L-1) + 5*(L-1)^2`; 1–50 at launch; **224,420 cumulative XP** from level 1 to 50. XP continues accruing at level 50 for global lifetime leaderboard and future expansions. No XP-to-SP conversion.
- Ranks: Rookie 1–4, Entrepreneur 5–9, Founder 10–19, Executive 20–29, Tycoon 30–39, Empire Legend 40–50.
- One permanent global leaderboard by lifetime XP, no resets or SP rewards. Show top 100 and player's own position where practical. Public profile: username, avatar, level, rank, total XP, three featured achievement badges (one primary shown by leaderboard username). No email, wallets, balances, deposits, withdrawals or referral data public.
- **Pacing decision for V2.4:** Preserve the approved XP formula and modest task rewards; **withdraw the unvalidated 60–90-day promise for reaching level 50**. Level 50 is a long-term prestige goal. Within 60–90 days target meaningful rank/achievement advancement, not level 50. Do not claim a specific achievable level or day count without reproducible simulation. This is an explicit design tradeoff to avoid huge achievement payouts and inflation of XP. If the owner later insists on level 50 in 60–90 days, seek approval for a *separate* rebalance; do not quietly alter the formula.

## 6. Daily and weekly tasks — V2.4 values locked for implementation
Five daily tasks (available to the free Intern owner): Daily Login (login once) **10 XP**; Start Production (start 1 cycle) **15 XP**; Collect Production (collect 1 completed cycle) **20 XP**; Active Manager (start 3 cycles) **30 XP**; Daily Operator (collect 3 cycles) **40 XP**. All-five completion bonus **50 XP** (previously approved). Maximum **165 XP/day**.

Five weekly tasks: Weekly Visitor (login on 5 distinct UTC dates) **100 XP**; Production Starter (start 15 cycles) **150 XP**; Production Collector (collect 15 cycles) **200 XP**; Consistent Manager (complete all daily tasks on 3 distinct UTC dates) **250 XP**; Weekly Champion (collect output on 5 distinct UTC dates) **300 XP**. All-five completion bonus **250 XP** (previously approved). Maximum **1,250 XP/week**.

**Reset times — V2.4 defaults:** daily 00:00 UTC; weekly Monday 00:00 UTC. Server time only. Count an action at its authoritative completion/collection timestamp; protect against boundary races. Task progress resets; already earned and verified but unclaimed rewards **persist indefinitely**. Rewards require manual Claim or free Claim All; atomic and idempotent. For weekly Consistent Manager, daily completion counts when all five daily tasks are fulfilled, even if reward claims occur later. Free player must be able to complete daily/weekly tasks without purchases.

## 7. Achievements and badges — V2.4 thresholds and XP values
Permanent, cumulative, never reset. For each achievement track, stages Bronze/Silver/Gold/Diamond with thresholds and one-time **XP only** reward per stage. These are conservative launch defaults, not extra withdrawable value:

| Track (lifetime cumulative) | Bronze | Silver | Gold | Diamond | XP reward per stage |
|---|---:|---:|---:|---:|---|
| CEO cycles collected | 5 | 25 | 100 | 500 | 50 / 150 / 400 / 1,000 |
| CEO copies acquired incl. Intern | 1 | 3 | 10 | 30 | 25 / 100 / 300 / 800 |
| CEO copies exhausted | 1 | 3 | 10 | 25 | 50 / 150 / 400 / 1,000 |
| Earned SP collected, cumulative | 20 | 500 | 5,000 | 50,000 | 50 / 150 / 400 / 1,000 |
| Distinct UTC login days | 3 | 14 | 45 | 120 | 50 / 150 / 400 / 1,000 |

All stages shown with progress; rewards require Claim or Claim All, each once. Badge tier upgrades automatically upon achievement qualification; **badge upgrades have no gameplay or monetary effect**. Up to 3 featured badges, one primary, free changes. Each track's achievement XP total is bounded; do not create repeatable milestone XP loops. Existing past events must count when deriving lifetime counters from trustworthy records.

## 8. Special tasks, referrals
Special campaigns are Admin-created only in V2; configurable XP and/or **Bonus SP** reward, dates, participant caps, and proof requirements. Internal events auto-verified; external proof URL/text manually reviewed. Three proof attempts total, no simultaneous duplicate pending proof. Atomically reserve a slot at first proof submission, keep during review/retries, release on final failure/closure; approvals consume slots. Campaign expiry blocks new entrants, not review or allowed retries by already reserved participants. Snapshot reward/terms on reservation; no retroactive changes. One approval/reward per player per Special campaign. Claims are manual and idempotent. **Admin-configured rewards must be bounded by permissions and audited**; require an explicit admin confirmation for unusually high XP/Bonus SP awards, rather than hardcoding an unapproved economic amount.

Referrals (owner-confirmed V2.5): **10 Bonus SP** per qualified referral; **10% recurring commission** on every confirmed eligible paid CEO purchase by a referred user (commission accrues on each eligible purchase, not once); referral attribution is **permanent** (the inviter assigned at registration is immutable). **No rewards** are granted for self-referrals, duplicate accounts/purchases, failed payments, or refunded purchases. **Unresolved — owner decision required before activation:** the commission currency, the exact qualification criteria, and refund/chargeback handling. **V2.4 qualification defaults (apply until superseded):** referred account must verify email and have a unique inviter assigned at registration (immutable); award registration bonus once after verification. Reject self-referrals, recycled registrations, suspicious duplicate identities, and referrals where account or transaction is reversed/fraudulent. Commission only on successfully settled eligible CEO purchases (exclude fees, refunds, chargebacks, free awards and bonus-funded transactions), calculated from purchase value using 1 USDT = 1,000 SP; claw back reversed commissions from Bonus SP where feasible, or freeze for admin review. No multi-level referral commissions. Referral rewards remain **disabled** pending approved qualification.

## 9. Deposits, withdrawals and wallet security
### Payment Gateway — OxaPay (selected integration provider; production approval pending)
- **Provider selection:** OxaPay is the designated gateway for initial integration planning and testing, replacing the earlier unspecified-provider placeholder. This does **not** authorize live transactions or imply endorsement, proven reliability, regulatory approval, or provider acceptance of the TycoonX business model.
- **Deposits:** Offer multiple cryptocurrencies and networks through OxaPay, including USDT across supported networks and, where currently available, USDC, BTC, ETH, LTC, and other provider-supported assets. Query/verify current assets and networks during integration; never hardcode unsupported routes or assume BEP20-only deposits.
- **Settlement and crediting:** Before implementation, confirm whether OxaPay can settle/convert incoming assets into the required accounting currency, supported merchant account configuration, exchange-rate quotation and expiry, fees, minimums, underpayments/overpayments, late payments, refunds and transaction reversals. These details remain integration-stage decisions, not invented defaults. Deposit credit must use the confirmed net/accounting amount under an approved rule; never equate an unverified on-chain transfer with credited SP.
- **Payment processing:** Create invoices server-side; keep merchant and payout credentials server-side and separate. Verify callback authenticity using OxaPay's current documented verification mechanism, independently reconcile payment state through a trusted server-side query when appropriate, and credit a payment **exactly once** using unique invoice/transaction IDs, immutable ledger entries, and idempotent processing. Handle pending, expired, partial, duplicate and delayed notifications.
- **Withdrawals:** USDT on BNB Smart Chain (BEP20) only, subject to OxaPay's actual supported payout route, minimums and current fees. Retain mandatory Admin approval and the wallet security holds below. Never permit browser-side payout calls, auto-payout before approval, or reuse deposit-only credentials for payouts.
- **Go-live gates:** Obtain written confirmation that the provider permits TycoonX's paid CEO / finite withdrawable-production model; verify merchant eligibility and any KYC/AML, jurisdictional and regulatory obligations; validate current API documentation, fees and limits; complete small controlled end-to-end deposit and payout tests, callback replay tests and reconciliation; approve operations and risk controls. If any gate fails, keep payment features disabled and request owner approval for alternatives. Do not store live keys in repository/docs.

### Withdrawal rules and wallet security
- Withdrawals: **USDT BEP20 only**. Minimum **1,000 Earned SP = 1 USDT**; flat fee **0.25 USDT** (owner-approved, equal to the confirmed OxaPay BEP20 provider fee; no platform margin). **Fee interpretation:** minimum applies to gross request amount; fee deducted from gross exactly once, so a 1 USDT request pays 0.75 USDT to wallet; show fee/net before confirmation. One pending request/account. Next request permitted only 24h after successful payout. Lock gross Earned SP atomically on request; release on rejection/cancellation, settle once on payout. Do not allow Bonus SP withdrawals.
- One saved withdrawal wallet/account. Changing it sends immediate email and blocks **new withdrawal requests for 24 hours** from last change. A subsequent change restarts the hold. CEO activity unaffected. Validate BEP20 address/network and display warning against wrong network.
- **V2.4 pending-withdrawal policy:** any existing pending withdrawal is automatically put **on security hold for manual Admin review** when wallet is changed; it retains its originally submitted address and cannot be redirected by the change. Admin can cancel/refund or, after review and hold expiry, authorize payout to the **original** address only with an explicit operator check. Never silently send to the new address. Audit every status transition.
- Admin approval of withdrawal is required; OxaPay payout integration remains disabled until the go-live gates above are met. Before gateway integration, build safe request/review states only, not pretend to transfer crypto. Enforce idempotent payout reconciliation, exact amounts, and fraud checks before any real withdrawals go live.

## 10. UI/UX freedom — explicit OpenCode authorization
**OpenCode may independently design, restructure, replace, refactor or remove existing code that controls the appearance, layout, navigation, pages, visual components, styling, animations, responsive behavior and section presentation** to create a coherent polished mobile-first tycoon PWA. It may select typography, color palette, avatar illustration direction, dashboard information hierarchy, page composition, icons and microinteractions without asking approval for each choice. It may consolidate, rename, add or remove purely presentational sections as long as all required launch features remain accessible and usable. Do not retain legacy UI solely for compatibility if it is confusing.

**Boundaries:** This is NOT authorization to change CEO prices, caps, production semantics, SP accounting, XP formula, reward values, withdrawal rules, identity/privacy/security, permissions, or postponed-feature scope. Avoid unnecessary framework rewrites, migration breakage, or deletion of business logic when changing UI. Prefer adapting to the existing repository stack; propose a stack replacement first if essential. Design for touch, small screens, accessibility, loading/error/empty states, and English-first localization. Do not depict withdrawable rewards as guaranteed investment returns.

## 11. Technical and operational charter
- First inspect the repository and old `/docs` read-only. Identify actual framework, architecture, migrations, implemented features and conflicts. Existing code does not outrank this spec. Preserve prior approved requirements not contradicted here.
- Implement modular services, server-side authorization, transactional ledger, immutable/auditable event history, deterministic UTC schedules, secure password storage, rate limits, CSRF/session protection, robust validation and minimal exposure of private data.
- Write focused tests for concurrent collect/claim/purchase/withdraw, CEO cap exhaustion, cycle changes, refunds, resets at UTC boundaries, referral replay, pending withdrawal wallet changes and role permissions. Test production cap with all equipment durations and bulk actions.
- Use small incremental tasks, read only relevant docs/code for each task, modify only necessary files, and run targeted tests. After each verified milestone update `docs/PROGRESS.md` with done/next/blockers; never mark untested work complete.
- Never insert live credentials, fabricate OxaPay capabilities, or activate real deposits/withdrawals before explicit integration authorization. Avoid dependencies or architectural rewrites unless needed.
- When a missing value is genuinely operationally necessary and not specified here, use a safe **nonfinancial** technical default and document it. Escalate any missing financial parameter or material conflict to the owner. Never improvise withdrawable rewards.

## 12. Documentation reconciliation and workflow
1. Place this file in `/docs/TYCOONX_V2_MASTER_SPEC.md`.
2. OpenCode audits the existing repo and docs **without modifying anything**, and returns a compact conflict/migration report.
3. Once reviewed, keep **this master spec as the single product-rules source of truth** plus `docs/PROGRESS.md` for implementation status. Archive superseded docs only after checking for unique requirements; do not delete without approval. Do not create duplicate `GAME_RULES.md` / `DEVELOPMENT_RULES.md` copies unless a genuine need emerges.
4. This master spec remains the canonical product-rules source after reconciliation. Avoid copying its full text into every prompt.
5. Suggested prompt after approval: "Audit `/docs/TYCOONX_V2_MASTER_SPEC.md` against existing code and docs. Report conflicts and implementation plan only; do not modify files. Treat UI code as freely redesignable but preserve all game-economy and security invariants. Be concise."

## 13. Release gates and known risks
**Not certified as balanced or legally approved.** The approved CEO caps and prices imply real-world payout exposure; a cap limits exposure per copy but **unlimited copies do not limit aggregate exposure**. Before enabling real payments or withdrawals, perform reproducible scenarios for active/inactive users, simultaneous CEOs, equipment effects, refund/chargeback and referral abuse, nominal payout liabilities, gateway fees and payout controls. Obtain applicable legal/compliance review. Do not claim economic sustainability or guaranteed profit.

**XP sanity check:** At perfect task completion, 165 XP/day plus 1,250 XP/week = **2,405 XP per 7 days** before achievements. Level 50 requires 224,420 XP, so the old 60–90 day goal is mathematically incompatible with the task XP scale absent very large extra XP sources. This spec deliberately treats level 50 as long-term rather than injecting untested XP. Model player schedules and achievement unlocks before announcing a specific progression time.

**Version 2.5 change:** OxaPay selected for integration planning with explicit verification, security, and go-live gates; master-spec-plus-progress documentation model clarified. All previously approved economic parameters remain unchanged.

**End of master specification.**
