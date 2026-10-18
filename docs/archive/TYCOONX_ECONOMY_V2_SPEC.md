# TycoonX — Economy & Gameplay Specification V2.3

**Status:** Product design draft for approval; NOT authorization to deploy payments, advertise returns, or migrate a database.  
**Date:** 2026-10-17  
**Audience:** Product owner, developers, administrators, security and compliance reviewers.  
**Implementation target:** Existing TycoonX React/Vite client, Express/TypeScript server, Prisma/Neon PostgreSQL, with OpenCode / DeepSeek V4.1 Flash.  
**Visual scope:** Phase 5H is paused. Preserve existing visual work and do not redesign UI as part of this specification.

## 1. Product objective and boundaries

TycoonX is a technology-empire management game in which players own CEO units, start timed production cycles, earn **SP**, level up using XP and Tech Parts, operate buildings, complete missions, and potentially redeem eligible SP for **USDT** at a stated fixed conversion rate. Users may own paid CEO units and receive free/reward units. Marketing should emphasize gameplay and transparent reward rules, not guaranteed returns, passive investment income, risk-free earnings, or recovery of purchase costs.

**Critical distinction:** A fixed conversion rate creates a real redemption liability for every redeemable SP unit issued. CEO ownership is permanent, but permanent ownership must not be represented as an unconditional right to unlimited future funded rewards. All SP issuance must be backed by an auditable reserve/authorization process. Financial operation requires independent legal, payments, consumer protection, AML/KYC, sanctions and tax review in target markets before launch. No live payment, exchange or withdrawal functionality should be enabled on the strength of this document alone.

## 2. Decision register

### 2.1 Approved product decisions

| ID | Decision |
|---|---|
| D01 | Fixed proposed conversion: **10,000 SP = 1 USDT** (fixed-rate model selected; numeric rate is the current design baseline and needs final sign-off). |
| D02 | Each CEO template has a configurable **fixed SP output per 4-hour production cycle**, not a percentage of purchase price. |
| D03 | Production is manual: start, wait for completion, collect, then manually restart. No auto-restart. |
| D04 | Both individual and **bulk start/collect** actions are supported. |
| D05 | One free starter CEO is granted once to each eligible new account. |
| D06 | Players may own multiple copies of paid CEO templates, with per-template limits configurable in admin. |
| D07 | CEO ownership is permanent; stopping new issuance or a limited-cycle unit reaching zero cycles does not delete ownership. |
| D08 | Reward CEOs can have **unlimited count of eligible cycles** (subject to issuance/funding rules) or a **finite configurable cycle allowance**, chosen per mission. |
| D09 | Mission submissions and rewards require **manual administrator approval**. Automatic signals may support review but never substitute for approval in V1. |
| D10 | Missions include creator videos, social posts, referral milestones, first purchase, gameplay, daily/weekly and campaigns. |
| D11 | All key prices, production rates, cycle limits, mission rewards, eligibility and energy/upgrade parameters are configurable from admin with audit trail and effective dates. |
| D12 | SP is redeemable under published terms; XP, Tech Parts and Energy are not redeemable. USDT is tracked separately. |
| D13 | No transfer/trading of owned CEOs between players in the initial version. |
| D14 | All financial/reward calculations are server-authoritative and protected against duplicate processing. |

### 2.2 Proposed parameters — NOT yet approved for production

- Initial CEO prices, SP production, energy cost, and ownership caps in §3.
- Energy capacity 100, regeneration 1 energy / 5 minutes.
- Five CEO levels with cumulative bonuses 0%, 10%, 20%, 35%, 50%.
- Tech Parts upgrade costs 100, 300, 800, 2,000; level requirements 2, 5, 10, 20.
- Sample buildings, costs, bonus caps, missions and referral rewards.
- Redemption minimum 50,000 SP (5 USDT), network and fees.
- Rules for partial bulk execution, cycle allowance consumption and budget reservations as detailed below are recommended engineering decisions pending sign-off.

## 3. CEO catalog and ownership

### 3.1 Initial sample catalog

| CEO template | Price USD-equivalent | Base SP / 4h cycle | Energy / cycle | Max owned copies | Max SP/day per copy at 6 cycles (no upgrades) |
|---|---:|---:|---:|---:|---:|
| Intern CEO | Free | 10 | 2 | 1 | 60 |
| Junior Developer | 5 | 20 | 3 | 10 | 120 |
| Product Manager | 15 | 40 | 4 | 8 | 240 |
| Marketing Director | 30 | 65 | 5 | 7 | 390 |
| Startup Founder | 50 | 95 | 6 | 6 | 570 |
| AI Architect | 100 | 150 | 8 | 5 | 900 |
| Cloud Executive | 200 | 230 | 10 | 4 | 1,380 |
| Tech Billionaire | 500 | 400 | 12 | 3 | 2,400 |
| Crypto Whale | 1,000 | 600 | 15 | 2 | 3,600 |

**Interpretation:** All output is theoretical at full utilization, excluding availability, energy, budget limits, fees and downtime. Do not display these as guaranteed returns or ROI. Prices and outputs are separate editable fields. Current project catalog contains eight paid CEOs and percentage-style yields; migration to this nine-unit sample catalog requires explicit approval and data compatibility planning.

### 3.2 Ownership rules

- `CeoTemplate` describes the catalog item. `OwnedCeo` represents a particular user's unique copy. Each copy has a unique ID, level, origin, reward cycle allowance and status.
- Starter grant is idempotent, one per eligible user; no duplicate on retry, OAuth/account relinking or registration replay. Eligibility/anti-Sybil checks are required.
- Admin lowering an ownership cap affects future acquisitions, not existing property. Disable **new sales** without deleting owned units.
- For reward CEOs, store `cycleLimit: null` for unlimited-cycle type or a nonnegative integer for limited-cycle type; `completedRewardCycles` tracks successful rewarded claims. Ownership remains after exhaustion.
- Do not permit negative allowances, transfers, or a second simultaneous production cycle for the same owned copy.
- Reward CEOs may use existing or exclusive templates. Mission grants must be idempotent and traceable to the approved submission.

## 4. Production lifecycle and bulk actions

### 4.1 State machine

`IDLE → PRODUCING → READY_TO_COLLECT → IDLE`. Other administrative states (`PAUSED`, `DISABLED`) require recorded reason and cannot silently confiscate earned balances. A finite-cycle CEO with exhausted allowance remains owned and visible as `EXHAUSTED` for reward production.

1. **Start:** Server validates ownership, eligible state, account/CEO restrictions, sufficient energy, remaining reward cycles, current rules and **available fully funded issuance capacity**. Reserve maximum SP liability for the cycle atomically; deduct energy; snapshot the applicable rate/bonuses and create a cycle with start/end timestamps.
2. **Time:** Exactly 4 hours by default; production does not continue after end time. No reward is calculated on client time.
3. **Collect:** After end time, a server transaction marks cycle claimed, credits SP ledger exactly once, consumes one finite reward cycle, converts reserved issuance to actual issued liability and awards any nonfinancial progress resources.
4. **Restart:** Requires an explicit subsequent start, with fresh checks and settings. An old unclaimed cycle does not accumulate additional SP.
5. **Errors:** If a start transaction fails, neither energy nor reserve nor a cycle should be partially committed. Retry collection with the same idempotency key must not credit twice.

**Proposed allowance policy:** Deduct a finite-cycle allowance on **successful claim**, not start. Reserve eligibility for that cycle while active; do not allow concurrent cycles. If a completed cycle is unclaimed, it occupies the unit until claimed; cancellation and admin correction require explicit policies and audit logs.

### 4.2 Formula

`cycleSp = floor(baseSpPerCycle × (1 + cumulativeCeoUpgradeBonus + applicableBuildingBonus + campaignBonus))`, subject to a global configured bonus cap and funded issuance reservation. Use fixed-point integer math or rational basis points; no floating-point financial accounting. Freeze the complete formula inputs at cycle start. `dailyTheoreticalSp = cycleSp × min(6, actually runnable cycles)` for a four-hour cycle; do not use it as a payout guarantee.

### 4.3 Bulk operations

- Client supports selecting specific copies, `Start Selected`, `Start All Eligible`, `Collect Selected`, `Collect All Ready`.
- Server validates **each** requested owned ID and enforces a request size limit. Use per-item results (`started`, `collected`, `skipped`, `reason`) and an idempotency key for the overall operation.
- **Recommended policy:** Deterministic partial success: eligible items are processed atomically per item, with consistent lock ordering and budget checks; user sees exactly which succeeded. Do not claim all succeeded if some failed.
- No automatic restart or collection. Server time is authoritative; UI can display countdown estimates only.

## 5. Energy and progression

### 5.1 Energy (sample values)

- Shared user energy pool: capacity **100**, regenerate **1 per 5 minutes**, never exceed current cap.
- Regeneration is calculated on server from last update, using elapsed whole intervals; updates must be transactional under concurrency.
- CEO energy costs appear in §3. Starting multiple copies deducts their combined cost only for successful starts.
- Power Plant can increase capacity; Energy Lab can increase regeneration. Changes take effect prospectively and must avoid overfilling/exploit loops.
- Extra energy from missions is separately controlled, with a clear cap/overflow policy.

### 5.2 Progress resources

- **XP:** nontransferable, nonredeemable progress; player levels unlock content.
- **Tech Parts:** nonredeemable crafting/upgrade resource, with source/usage ledger.
- **Energy:** time-based action resource.
- **SP:** redeemable points; separate liability-backed ledger.
- **USDT:** separate real-money accounting and payment state, not simulated by adding numbers to SP balance.

## 6. CEO upgrades

| Level | Cumulative production bonus | Proposed Tech Parts cost to reach | Proposed player-level requirement |
|---|---:|---:|---:|
| 1 | 0% | Included | 1 |
| 2 | +10% | 100 | 2 |
| 3 | +20% | 300 | 5 |
| 4 | +35% | 800 | 10 |
| 5 | +50% | 2,000 | 20 |

- Each `OwnedCeo` levels independently; costs can vary by template and level.
- A CEO upgrade during a running cycle affects **future cycles only**.
- Upgrades require prerequisite checks and atomic deduction of Tech Parts.
- Paid upgrades are **not** enabled in initial gameplay testing. Any later monetized upgrade that increases redeemable output needs its own pricing and risk review.

## 7. Buildings and empire

| Building | Sample unlock cost (Tech Parts) | Primary function |
|---|---:|---|
| Headquarters | Free | Empire progression and feature unlocks |
| Power Plant | 200 | Energy capacity, e.g. +25/+50/+100 by level |
| Energy Lab | 500 | Energy regen, e.g. +10%/+20%/+30% |
| Server Farm | 750 | Bounded SP output bonus |
| Research Center | 1,000 | Advanced CEO upgrades |
| Training Center | 400 | XP bonus |
| Operations Hub | 1,500 | Bulk operations / convenience |

Buildings are permanently owned. All bonuses must have a declared stacking order and a configured **global SP output bonus cap** (sample +75%, not approved). A building cannot retroactively modify a started production cycle. Avoid granting redeemable SP solely from an unfunded building perk.

## 8. Missions and promotional campaigns

### 8.1 Mission categories

- **Creator missions:** original TycoonX video on YouTube/TikTok/Instagram/X; manual assessment of quality, originality, views and legitimate engagement. Reward tiers may grant XP, Tech Parts, SP from a funded budget, or a reward CEO.
- **Referral milestones:** **3, 5, 10, 25, 50, 100, 1,000** eligible referrals, cumulative one-time awards, no repeat claims for same threshold.
- **Social:** share an official post, publish an original honest review, participate in a campaign. Require relevant links and sponsored/incentivized-content disclosure; never require positive reviews or false earnings claims.
- **Purchase milestones:** first CEO purchase, collection milestones and distinct CEO ownership. Reward XP/Tech Parts or budgeted prizes; purchase should not be required for every advancement route.
- **Daily/weekly gameplay:** login, cycle starts/claims, upgrades, energy management, levels and building progress.
- **Ambassador program:** creator/partner/ambassador tiers for sustained quality content and genuine community participation; separate from direct referral counts.

### 8.2 Sample rewards — placeholders, not promises

| Mission | Example condition | Example reward |
|---|---|---|
| Original creator video | Accepted original submission | 300 Tech Parts + 200 XP |
| Rising Creator | Quality review + 1,000 eligible views | Creator CEO (configured grant type) |
| Pro Creator | Quality review + 10,000 eligible views | Exclusive CEO or funded SP |
| Viral Creator | 100,000 eligible views | Campaign-specific reward |
| 3 referrals | 3 eligible referred accounts | 100 XP + 50 Tech Parts |
| 5 referrals | 5 eligible referrals | 200 XP + 100 Tech Parts |
| 10 referrals | 10 eligible referrals | Junior Developer CEO |
| 25 referrals | 25 eligible referrals | 500 XP + 400 Tech Parts |
| 50 referrals | 50 eligible referrals | Referral Specialist CEO |
| 100 referrals | 100 eligible referrals | 1,000 XP + exclusive CEO |
| 1,000 referrals | 1,000 eligible referrals | Elite Ambassador tier + campaign reward |
| First paid CEO | Verified completed purchase | 100 XP + 100 Tech Parts |

### 8.3 Manual review workflow

`AVAILABLE → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED / NEEDS_MORE_INFO`.

- User supplies platform, public URL, content description and optional evidence. Do not request unnecessary sensitive data.
- Admin checks URL uniqueness, originality, eligibility, engagement authenticity, campaign rules and required incentive disclosures.
- **Only a manual approval action** may trigger reward grant in V1, even if automated checks pass. Rejection includes reason and resubmission rules.
- One submission can award a bundle (CEO + XP + Tech Parts + SP + badge). Every award is issued once using unique `submissionId/rewardId` constraints.
- Manual review queues support filtering and audited batch decisions; avoid unreviewed bulk approvals.
- Creator metrics can change; define a measurement window and freeze verified counts on approval.
- Referral eligibility must reject self-referrals, duplicate/farmed accounts and fake engagement. Do not require referred users to buy to count as active/qualified.

### 8.4 Reward CEO grant contract

A mission can grant a permanent owned CEO with either:
- `UNLIMITED_CYCLES`: no predefined cycle count, but each future SP-producing cycle still requires funding authorization; or
- `LIMITED_CYCLES`: a positive integer cycle allowance set when the reward is approved.

The reward grant must explicitly display the template, production per cycle, upgrade eligibility, number of eligible cycles (if limited), and any conditions. **Neither grant may create an unfunded future payment promise.** If the system cannot support unlimited funded production, do not market the unit as providing unconditional permanent financial returns.

## 9. Referral attribution and milestones

- Preserve `?ref=CODE` from landing through registration; attribution should be set once with anti-fraud checks.
- Eligible referral definition: distinct real account, basic verification and genuine gameplay activity; not merely a click, and no mandatory purchase.
- Milestone awards cumulative and one-time; track `referralMilestoneId + userId` uniqueness and approval status.
- Previously discussed **10% / 2% / 1%** multi-level deposit commissions are **future-only, not part of this implementation**. Do not implement or advertise them before independent review and explicit approval.
- Admin can adjust milestone thresholds/rewards for future campaigns without removing rewards already earned.

## 10. SP conversion, reserve and payment boundary

### 10.1 Conversion

- Proposed fixed exchange: `10,000 SP = 1 USDT`.
- Use integer SP and integer USDT micro-units (or suitable fixed decimal precision). Conversion: `usdtMicro = sp × 1,000,000 / 10,000`, with defined rounding and minimum units.
- Proposed minimum request: **50,000 SP = 5 USDT**, subject to payment/network fees and final approval.
- A fixed exchange rate must be versioned; **do not retroactively devalue previously earned SP**. Any future change requires clear user-facing policy and treatment of existing liabilities.

### 10.2 Funded issuance control

- Each redeemable SP represents `SP / 10,000` USDT of liability at the agreed rate.
- Before a cycle starts, atomically reserve the **maximum potential SP reward** against an actually funded, reconciled reward pool. Do not count unreceived future sales, unverified ad revenue or new-user purchases as already available reserves.
- Track `fundedUsdt`, `reservedForActiveCyclesUsdt`, `outstandingEarnedSpLiabilityUsdt`, `pendingRedemptionsUsdt`, `settledRedemptionsUsdt`, plus fees/buffer.
- Available funding must never become negative; reject new starts/grants when no budget is available, while preserving owned units and earned balances.
- Mission SP awards and reward CEOs require explicit funded budgets. For unlimited-cycle reward CEOs, future cycles remain subject to separately funded issuance; do not claim the grant itself funds infinite future rewards.
- Separate custodial reserve accounting from operating revenue. Conduct reconciliation, solvency alerts and independent audits before financial launch.

### 10.3 Redemption state machine (future, not Phase 6 implementation)

`REQUESTED → VALIDATING → APPROVED → BROADCAST → CONFIRMED`, with `REJECTED`, `FAILED`, `CANCELLED` branches and explicit refund/unlock behavior. SP is atomically locked at request time and burned/settled only on confirmed payment. Idempotency, on-chain confirmation checks, supported network selection, AML/KYC/sanctions screening and transparent fees are mandatory before live use.

### 10.4 Marketing and disclosure rules

- Display CEO purchase price and **SP per cycle**, not guaranteed USDT yield, payback time or profit percentage.
- State clearly that production requires manual cycles, energy, eligibility and funded reward capacity; disclose potential pauses to new production before purchase.
- Do not promise that a purchase will recover its price, that a CEO generates permanent monetary income, or that a referral investment is risk-free.
- Sponsored/incentivized video and social content must be clearly disclosed and must not include fabricated earnings testimonials.

## 11. Admin Economy Control Center

**Sections:** CEO Catalog, Owned CEO Administration, Upgrade Rules, Energy Rules, Buildings, Production Rules, Mission Builder, Manual Review Queue, Referral Milestones, Reward Budgets, SP Exchange & Reserve, Audit Logs, System Controls.

Admin-adjustable fields include template price, availability, SP/cycle, energy cost, copy cap, starter status, upgrade costs/bonuses, cycle duration, energy regeneration, building costs/bonuses, reward CEO finite/unlimited type, mission verification rules, milestone thresholds, reward bundles, budget caps, redemption fees/minimum and eligibility limits.

**Controls:**
- Admin RBAC and strong authentication; require two-person approval for high-impact financial parameter changes where feasible.
- `effectiveAt`, `createdBy`, `reason`, old/new value snapshots and immutable audit trail.
- Version every economic config; snapshot relevant values into production cycles and approved mission grants.
- Preview impact of changes on theoretical issuance and outstanding liabilities before publishing.
- Emergency stop for **new** production/reward issuance and **new** sales; never silently alter accrued balances or existing cycle obligations.
- Review queues with approve/reject/request-info, evidence links and immutable decision records.

## 12. Suggested database design (conceptual, adapt to existing Prisma schema)

Do **not** blindly create these models; audit existing names/relations and migration drift first.

| Entity | Purpose / essential fields |
|---|---|
| `EconomyConfigVersion` | version, effectiveAt, rate, energy rules, bonus cap, createdBy, reason |
| `CeoTemplate` | id, name, category, priceMinor, baseSpPerCycle, energyCost, maxOwned, enabled, reward eligibility |
| `OwnedCeo` | id, userId, templateId, acquisitionType, acquiredAt, level, cycleLimit nullable, completedRewardCycles, status |
| `ProductionCycle` | id, ownedCeoId, userId, startsAt, endsAt, status, rewardSpSnapshot, configVersion, reservedLiability, claimedAt |
| `EnergyAccount` | userId, energy, capacity, lastRegeneratedAt, version |
| `ProgressAccount` | userId, xp, playerLevel, techParts (or ledgers) |
| `BuildingTemplate` / `OwnedBuilding` | config, ownership, level and modifiers |
| `SpLedgerEntry` | id, userId, amountSigned, sourceType, sourceId, createdAt, immutable, unique source event |
| `RewardReserveLedger` | funding, reservations, release, issuance, redemption liabilities, external reconciliation IDs |
| `MissionDefinition` | type, rules JSON/schema, schedule, eligibility, rewards, budget, enabled |
| `MissionSubmission` | userId, missionId, evidence, status, reviewerId, review reason, timestamps |
| `MissionRewardGrant` | submissionId, rewardIndex, type, amount/template, issuedAt, unique idempotency constraint |
| `ReferralAttribution` | inviter, referred user, timestamp, eligibility state |
| `ReferralMilestoneAward` | userId, milestoneId, status, approvedBy, awardedAt, unique per user/milestone |
| `AdminAuditLog` | actor, action, entity, before/after, reason, timestamp |
| `PaymentOrder` / `RedemptionRequest` | **Future phase only**; immutable monetary states and external references |

### Database and concurrency requirements

- PostgreSQL transactions, row-level locking or equivalent optimistic concurrency, unique constraints and server-only permission checks.
- No balances inferred from client-provided values. SP credits/debits must be backed by immutable ledger events.
- Unique claim constraint on `ProductionCycle` and unique source event for SP ledger; request idempotency keys for start, collect, bulk actions, purchases and admin grants.
- Atomic budget reserve/energy debit/cycle create; atomic claim/ledger credit/reservation settlement.
- User-visible history distinguishes `PENDING`, `EARNED`, `LOCKED_FOR_REDEMPTION`, `REDEEMED`.
- Handle clock skew, process restarts, network retries, concurrent tabs, delayed requests and admin config changes during cycles.

## 13. API outline (proposed, authenticated and validated)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/game/economy` | Published current config and disclosures |
| GET | `/api/game/ceos/owned` | Owned copies and cycle states |
| POST | `/api/game/ceos/:ownedId/start` | Start one eligible cycle |
| POST | `/api/game/ceos/:ownedId/collect` | Claim completed cycle once |
| POST | `/api/game/ceos/bulk-start` | Start selected copies with per-item results |
| POST | `/api/game/ceos/bulk-collect` | Claim selected completed cycles |
| POST | `/api/game/ceos/:ownedId/upgrade` | Upgrade one owned copy |
| GET | `/api/game/resources` | Energy, XP, Tech Parts, SP summaries |
| GET | `/api/game/sp/ledger` | SP transaction history |
| GET | `/api/game/missions` | Available missions and status |
| POST | `/api/game/missions/:id/submit` | Submit proof for manual review |
| GET | `/api/game/missions/submissions` | User's review status |
| GET | `/api/game/referrals/milestones` | Milestone progress |
| GET | `/api/admin/economy` | Admin config and funding dashboard |
| PATCH | `/api/admin/economy/...` | Versioned admin configuration changes |
| GET | `/api/admin/missions/submissions` | Manual review queue |
| POST | `/api/admin/missions/submissions/:id/decision` | Manual approve/reject/needs-info |

Use Zod validation, role-based authorization, pagination, rate limiting and CSRF protection appropriate to cookie auth. **Do not build live payment/redemption endpoints yet.**

## 14. Phased implementation plan for OpenCode

**Gate 0 — Review and sign-off:** Confirm sample economic numbers, cycle policy, funded-issuance rules, rewards, ownership limits and disclosure text. Audit Prisma schema/migration drift and back up database. No destructive reset.

**Phase 6A — Audit & schema design:** Inspect repo, schema, migration history, auth and CEO API; produce migration plan and test matrix. Documentation only first.

**Phase 6B — Ownership & starter:** Implement owned CEO copies, idempotent starter grant, catalog copy limits, owned fleet endpoints. Test concurrency and account abuse.

**Phase 6C — Production engine:** Implement server time, energy, single/bulk start and collect, snapshots, unique claim semantics, budget reservations. Use **test-only funded balances** initially; no USDT transfers.

**Phase 6D — Upgrades, buildings and progression:** XP, Tech Parts, CEO level upgrades, building modifiers, energy regeneration and caps.

**Phase 6E — Missions:** Mission definitions, evidence submission, manual review, reward bundles, finite/unlimited-cycle reward CEO grants, creator/referral milestones and anti-fraud checks.

**Phase 6F — Admin controls:** Editable versioned economy parameters, audit trail, preview tools, review queues, budgets and safety switches.

**Phase 6G — Full testing:** Unit/integration/concurrency tests, balance reconciliation, PWA mobile workflows, failure recovery and abuse simulations.

**Phase 6H — Financial readiness only after external sign-off:** Legal/regulatory review, custody/payment providers, reserve reconciliation, KYC/AML, secure redemptions, disclosures, live monitoring and incident response.

## 15. Acceptance tests / invariants

1. A user cannot receive more than one starter CEO, including concurrent registration retries.
2. A user cannot purchase beyond a template's copy limit, including simultaneous requests.
3. A copy cannot run two cycles simultaneously; a cycle cannot be claimed twice.
4. No SP credited before successful claim; no output accrues beyond cycle end.
5. No energy goes negative; regeneration never exceeds capacity.
6. Bulk operations report successes/failures correctly and are retry-safe.
7. A finite-cycle reward CEO consumes exactly one allowance on a successful claim and remains owned after exhaustion.
8. An approved mission reward is granted exactly once, even if admin repeats approval.
9. Referral milestone cannot be awarded twice; self/fake referrals do not qualify.
10. An admin config change cannot retroactively change an active cycle or earned SP.
11. No new redeemable SP liability is created without a valid funding reservation.
12. All ledgers reconcile; no negative funding availability or unbalanced redemption lock.
13. Existing authentication, CEO API and legacy dashboard routes remain functional.
14. No Phase 5H visual redesign assets or code are removed or altered unintentionally.
15. Build and automated tests pass; migration history is reconciled without destructive operations.

## 16. Outstanding approvals / open questions

1. Final numeric CEO catalog: purchase prices, SP per cycle, energy, caps and free unit eligibility.
2. Whether the **10,000 SP/USDT** numerical rate and minimum redemption are final; currency/network/fees are undecided.
3. Whether `LIMITED_CYCLES` allowance is consumed on successful claim (recommended) and how abandoned/cancelled cycles are treated.
4. Final upgrade costs and whether reward CEO copies may be upgraded.
5. Energy overflow, daily mission reset timezone and daily/weekly reward budgets.
6. Building bonus stacking/cap and whether Operations Hub unlocks bulk features or bulk is available by default.
7. Detailed anti-fraud and identity/eligibility requirements for starter, referrals and creator missions.
8. Reserve custodian, funding source, treasury reconciliation and rules for temporarily unavailable future production.
9. Whether reward CEOs with unlimited cycles can be marketed as such without implying unconditional financial returns; ensure disclosure and funding rules are coherent.
10. Payment and redemption launch requires separate compliance and financial sign-off.

## 17. Immediate next action

Do **not** send a broad “implement everything” prompt. First ask OpenCode to read this specification, compare it to the actual repo, and deliver a **read-only gap analysis and safe Prisma migration plan**. Once the owner approves the findings and the final numbers, proceed with Phase 6B in a small, tested change set. Keep all Phase 5H work intact.
