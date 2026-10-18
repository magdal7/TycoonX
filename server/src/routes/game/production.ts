import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAuth } from '../../middleware/auth'
import {
  collectProduction,
  startProduction,
  upgradeEquipment,
  ProductionError,
  type ProductionErrorCode,
} from '../../services/production'
import { getSpBalances, InsufficientSpError } from '../../services/spLedger'
import { getProgress } from '../../services/progress'
import {
  bulkIdsSchema,
  equipmentUpgradeSchema,
  ownedCeoIdParamSchema,
} from '../../validation/game'

const STATUS: Partial<Record<ProductionErrorCode, number>> = {
  not_found: 404,
  already_producing: 409,
  exhausted: 409,
  not_ready: 409,
  no_cycle: 409,
  invalid_equipment: 409,
  template_rate_missing: 503,
  cap_missing: 503,
}

function errorStatus(error: unknown): number | null {
  if (error instanceof ProductionError) return STATUS[error.code] ?? 400
  if (error instanceof InsufficientSpError) return 422
  return null
}

function spPayload(balances: { earnedSp: bigint; bonusSp: bigint; lifetimeEarnedSp: bigint }) {
  return {
    earnedSp: balances.earnedSp.toString(),
    bonusSp: balances.bonusSp.toString(),
    totalSp: (balances.earnedSp + balances.bonusSp).toString(),
    lifetimeEarnedSp: balances.lifetimeEarnedSp.toString(),
  }
}

export function createGameProductionRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth)

  /** GET /api/game/resources — SP balances + XP/level/rank. */
  router.get('/resources', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id
    const balances = await getSpBalances(db, userId)
    const progress = await getProgress(db, userId)
    res.json({ sp: spPayload(balances), progress })
  })

  /** GET /api/game/sp/ledger — immutable SP history (newest first). */
  router.get('/sp/ledger', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id
    const rows = await db.spLedgerEntry.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: 100,
    })
    res.json({
      entries: rows.map((r) => ({
        id: r.id.toString(),
        bucket: r.bucket,
        amountSp: r.amountSp.toString(),
        sourceType: r.sourceType,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  })

  /** POST /api/game/ceos/bulk-start */
  router.post('/ceos/bulk-start', async (req: AuthRequest, res: Response) => {
    const parsed = bulkIdsSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    const userId = req.user!.id
    const results: Array<{ ownedId: number; ok: boolean; reason?: string; cycle?: unknown }> = []
    for (const ownedId of [...parsed.data.ownedIds].sort((a, b) => a - b)) {
      try {
        const r = await startProduction(db, userId, ownedId)
        results.push({ ownedId, ok: true, cycle: r.cycle })
      } catch (error) {
        results.push({ ownedId, ok: false, reason: error instanceof ProductionError ? error.code : 'error' })
      }
    }
    res.json({ results, summary: summarize(results) })
  })

  /** POST /api/game/ceos/bulk-collect */
  router.post('/ceos/bulk-collect', async (req: AuthRequest, res: Response) => {
    const parsed = bulkIdsSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    const userId = req.user!.id
    const results: Array<{ ownedId: number; ok: boolean; reason?: string; rewardSp?: string }> = []
    for (const ownedId of [...parsed.data.ownedIds].sort((a, b) => a - b)) {
      try {
        const r = await collectProduction(db, userId, ownedId)
        results.push({ ownedId, ok: true, rewardSp: r.rewardSp })
      } catch (error) {
        results.push({ ownedId, ok: false, reason: error instanceof ProductionError ? error.code : 'error' })
      }
    }
    res.json({ results, summary: summarize(results) })
  })

  /** POST /api/game/ceos/:id/start */
  router.post('/ceos/:id/start', async (req: AuthRequest, res: Response) => {
    const parsed = ownedCeoIdParamSchema.safeParse(req.params)
    if (!parsed.success) return res.status(400).json({ error: 'invalid id' })
    try {
      const result = await startProduction(db, req.user!.id, parsed.data.id)
      res.json(result)
    } catch (error) {
      const status = errorStatus(error)
      if (status) return res.status(status).json({ error: (error as Error).message })
      throw error
    }
  })

  /** POST /api/game/ceos/:id/collect */
  router.post('/ceos/:id/collect', async (req: AuthRequest, res: Response) => {
    const parsed = ownedCeoIdParamSchema.safeParse(req.params)
    if (!parsed.success) return res.status(400).json({ error: 'invalid id' })
    try {
      const result = await collectProduction(db, req.user!.id, parsed.data.id)
      res.json(result)
    } catch (error) {
      const status = errorStatus(error)
      if (status) return res.status(status).json({ error: (error as Error).message })
      throw error
    }
  })

  /** POST /api/game/ceos/:id/equipment — upgrade to a higher equipment tier (costs SP). */
  router.post('/ceos/:id/equipment', async (req: AuthRequest, res: Response) => {
    const params = ownedCeoIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const body = equipmentUpgradeSchema.safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: body.error.flatten().fieldErrors })
    try {
      const result = await upgradeEquipment(db, req.user!.id, params.data.id, body.data.target)
      res.json(result)
    } catch (error) {
      const status = errorStatus(error)
      if (status) return res.status(status).json({ error: (error as Error).message })
      throw error
    }
  })

  return router
}

function summarize(results: Array<{ ok: boolean }>): { succeeded: number; skipped: number } {
  const succeeded = results.filter((r) => r.ok).length
  return { succeeded, skipped: results.length - succeeded }
}
