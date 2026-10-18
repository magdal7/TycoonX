# TycoonX

Mobile-first PWA tech CEO tycoon game.

## Docs

- `docs/TYCOONX_V2_MASTER_SPEC.md` — canonical product rules (source of truth).
- `docs/PROGRESS.md` — implementation status.
- `docs/ARCHITECTURE.md` — current system map.
- `docs/archive/` — superseded documentation.

## Stack

- React + TypeScript + Vite (client)
- Node.js + Express + TypeScript (server)
- PostgreSQL + Prisma
- Tailwind CSS

## Structure

- `/client` — frontend
- `/server` — backend
- `/shared` — shared types

## Scripts

From repo root:

- `npm run dev:client` — start Vite dev server
- `npm run dev:server` — start Express dev server
- `npm run dev` — run both concurrently

## Environment

Copy `.env.example` to `.env` in `/client` and `/server` before running.
