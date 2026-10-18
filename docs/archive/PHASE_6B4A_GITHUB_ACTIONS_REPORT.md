# TycoonX — Phase 6B.4A: GitHub Actions Prisma Migration Preflight — Report

**Status:** Workflow and report prepared. **No migration executed. No database writes. Nothing pushed.**  
**Date:** 2026-10-17  
**Repository:** https://github.com/magdal7/TycoonX (default branch `master`)  
**Companions:** `docs/PHASE_6B3A_EXECUTION_GATE.md`, `docs/PHASE_6B3B_MIGRATION_EXECUTION_REPORT.md`.

---

## 1. Workflow file path

```
.github/workflows/neon-migration-preflight.yml
```

- Trigger: **`workflow_dispatch` only** (no `push`, `pull_request`, or `schedule`).
- Runner: `ubuntu-latest`, `timeout-minutes: 15`.
- Permissions: `contents: read` (least privilege).
- Concurrency group `neon-migration-preflight` (no cancel-in-progress) to avoid overlapping runs.

### Steps (in order)
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20, `cache: npm`)
3. `npm ci --no-audit --no-fund` (workspace structure + root lockfile)
4. Verify frozen migration SHA-256 checksums
5. TCP connectivity to the Neon endpoint
6. Read-only database checks (branch, counts, ids, pre-migration state) via `psql`
7. `npx prisma validate`
8. `npx prisma generate` (codegen only)
9. `npm run build --workspace=server` (TypeScript)
10. `npm test --workspace=server`
11. Job summary (`if: always()`)

### Validation performed locally
- YAML parsed successfully (Python `yaml.safe_load`): 1 job, 11 steps, trigger `workflow_dispatch` only.
- All `run:` blocks concatenated and syntax-checked with Git Bash `bash -n` → exit 0.

---

## 2. Required GitHub secret names

| Secret | Purpose | Where to set |
|---|---|---|
| `DIRECT_URL` | Neon PostgreSQL connection string (production branch) used for TCP check, read-only queries, and Prisma env resolution | Repository → **Settings → Secrets and variables → Actions → New repository secret** |

Notes:
- The workflow reads the connection string **only** from `secrets.DIRECT_URL`. It is also mapped to the
  `DATABASE_URL` env var inside the job **solely** so `prisma validate` can resolve `env("DATABASE_URL")`;
  `validate` does not connect.
- **No secret is written to any file.** `.gitignore` already excludes `.env`/`.env.*`; nothing sensitive is
  committed.
- Optionally set an Environment with required reviewers to gate who may dispatch the workflow.

---

## 3. Manual execution instructions

1. Ensure the repository secret `DIRECT_URL` is set (see §2) and points to the **production** branch
   connection of project `wandering-king-57462138`.
2. In GitHub: **Actions → "Neon Migration Preflight (read-only)" → Run workflow**.
3. Select branch **`master`** and click **Run workflow**.
4. Open the run and read the **Job Summary** (and step logs) for the PASS/FAIL report.
5. The workflow performs **no** database writes; it is safe to re-run.

---

## 4. Connectivity verification method

- **TCP:** the endpoint host/port are parsed from `DIRECT_URL` with Node’s `URL` (values are never echoed);
  a bash `/dev/tcp` connect with a 15 s `timeout` confirms the endpoint accepts a TCP connection on its
  port (default 5432). Only the port number is printed.
- **Branch identity:** over the read-only connection, `SELECT current_setting('neon.branch_id', true)` is
  compared to `br-delicate-butterfly-b4et73g9`.
  - If the value is **empty**, branch identity is **UNVERIFIED** → the job **FAILS** and stops (no guessing).
  - If it **differs**, the job **FAILS**.
- **Read-only data checks:** `User` count/ids (`2` / `2,4`), `CEO` count/ids (`8` / `2,3,4,5,6,7,8,10`),
  username case-insensitive collisions (`0`), and confirmation that `_prisma_migrations`, `AppMeta`, and
  `OwnedCeo` do **not** exist (expected pre-migration state).
- **Checksums:** `sha256sum` on the two frozen migration files compared to the approved values.
- All database access is `SELECT`-only through `psql -Atc`.

---

## 5. Security precautions

- **Read-only by construction:** the workflow contains no `prisma migrate*`, no `prisma db push`, and no
  `INSERT/UPDATE/DELETE/CREATE/ALTER/DROP`. Only `SELECT` statements and `sha256sum`/`prisma validate` run.
- **Secret handling:** connection string comes from `secrets.DIRECT_URL`; it is passed via env, never
  echoed. `psql` stderr is captured to a file and **redacted** (`postgres…://…` → `[REDACTED_DSN]`,
  `*.neon.tech` → `[REDACTED_HOST]`) before any output, so hosts/DSNs are not printed.
- **Least privilege:** `permissions: contents: read`; dispatch-only trigger; no PR/push.
- **No history changes:** the workflow never creates/modifies `_prisma_migrations`.
- **Fail-closed:** any failed check exits non-zero; the job summary still reports the overall result.

---

## 6. Expected PASS/FAIL output

### PASS (abridged job summary)
```
### Frozen migration checksums
- ✅ checksum OK: server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql
- ✅ checksum OK: server/prisma/migrations/20261017010000_phase6b2a_username_case_insensitive/migration.sql
### Database checks
- ✅ branch OK: br-delicate-butterfly-b4et73g9
- Users: 2 (ids: 2,4)
- CEOs: 8 (ids: 2,3,4,5,6,7,8,10)
- Username case-insensitive collisions: 0
- ✅ User/CEO counts, ids and pre-migration state OK
- ✅ TCP connectivity OK (port 5432)
- ✅ prisma validate
- ✅ server TypeScript check
- ✅ server tests
---
Read-only preflight. No migrations, no writes, no history changes.
Result: ✅ PASS
```

### FAIL examples
- `Checksum mismatch` — a frozen migration file changed.
- `TCP connectivity FAIL` — endpoint unreachable from the runner.
- `Branch unverified` — `neon.branch_id` not exposed (STOP, no writes).
- `Branch mismatch` — connected to a branch other than production.
- `Unexpected …` — counts/ids/pre-migration state diverge (drift detected).

---

## 7. Notes, assumptions and risks

1. **Runner TCP reachability:** GitHub-hosted runners can normally reach Neon over TCP `:5432` (unlike the
   local Windows host that returned `P1001`). If the runner also cannot connect, the TCP step reports a
   clear FAIL.
2. **`neon.branch_id`:** if a given connection does not expose it, the workflow fails as *unverified*
   rather than guessing (per requirement).
3. **`npm ci` and the `shared` workspace:** root `package-lock.json` (v3) lists `client` and `server`
   workspace packages; `shared/` has no `package.json` (it is dependency-free). The lockfile was generated
   with this layout, so `npm ci` is expected to succeed. If `npm ci` ever errors on the `shared` workspace,
   the fix is to give `shared` a minimal `package.json` (separate approved change).
4. **`prisma generate`** is included before the TypeScript check so the client types exist on a clean
   runner (codegen only; offline engines from npm deps).
5. **No execution workflow** was created. This is a preflight/read-only workflow only.

---

## 8. Verdict

**Prepared.** The workflow is dispatch-only, read-only, secret-safe, and validated for YAML and shell
syntax. It is ready for a manual run once the `DIRECT_URL` secret is configured. No migration, data write,
history change, or push was performed.

**STOP.** Awaiting review/approval before any execution workflow is added.
