import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAuth } from '../../middleware/auth'
import { listOwnedCeos, OwnershipLimitError } from '../../services/ownership'
import { grantStarterCeo, STARTER_TEMPLATE_MISSING } from '../../services/starterCeo'

/**
 * GET /api/game/ceos/owned
 * Lists the authenticated user's OwnedCeo fleet. The user id always comes from
 * the verified session (`req.user.id`), never from the client.
 */
export function listOwnedCeosHandler(db: PrismaClient) {
  return async (req: AuthRequest, res: Response) => {
    const owned = await listOwnedCeos(db, req.user!.id)
    res.json({ owned })
  }
}

/**
 * POST /api/game/ceos/starter
 * Idempotently provision the one free starter (Intern) CEO for the authenticated
 * user. Replays return 200 with the existing copy; a first grant returns 201.
 */
export function grantStarterCeoHandler(db: PrismaClient) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const result = await grantStarterCeo(db, req.user!.id)
      res.status(result.created ? 201 : 200).json(result)
    } catch (error) {
      if (error instanceof OwnershipLimitError) {
        return res.status(409).json({ error: 'ownership limit reached' })
      }
      if (error instanceof Error && error.message === STARTER_TEMPLATE_MISSING) {
        return res.status(503).json({ error: 'starter CEO unavailable' })
      }
      return res.status(500).json({ error: 'internal error' })
    }
  }
}

/**
 * POST /api/game/onboarding
 * First-time authenticated game onboarding: idempotently ensures the free
 * starter (Intern) CEO exists, then returns the user's current fleet. Safe to
 * call on every session bootstrap; repeated calls never create duplicates.
 * Kept separate from /api/auth so registration never depends on the economy.
 */
export function onboardingHandler(db: PrismaClient) {
  return async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id
    try {
      const starter = await grantStarterCeo(db, userId)
      const owned = await listOwnedCeos(db, userId)
      res.json({ onboarded: true, starter, owned })
    } catch (error) {
      if (error instanceof OwnershipLimitError) {
        return res.status(409).json({ error: 'ownership limit reached' })
      }
      if (error instanceof Error && error.message === STARTER_TEMPLATE_MISSING) {
        return res.status(503).json({ error: 'starter CEO unavailable' })
      }
      return res.status(500).json({ error: 'internal error' })
    }
  }
}

export function createGameCeoRouter(db: PrismaClient): Router {
  const router = Router()
  router.get('/owned', requireAuth, listOwnedCeosHandler(db))
  router.post('/starter', requireAuth, grantStarterCeoHandler(db))
  router.post('/onboarding', requireAuth, onboardingHandler(db))
  return router
}