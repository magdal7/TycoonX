import type { Application, NextFunction, Request, Response } from 'express'

/**
 * Terminal JSON error handler. Registered after all routes. Async route
 * rejections reach this handler via `express-async-errors` (imported once at
 * startup), so a database or provider error returns a safe 500 instead of
 * terminating the process. Only non-sensitive identifiers are logged.
 */
export function installErrorHandling(app: Application): void {
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const name = err instanceof Error ? err.name : 'Error'
    const code = (err as { code?: unknown })?.code
    const suffix = typeof code === 'string' && code.length <= 16 ? ` code=${code}` : ''
    console.error(`[http] unhandled error ${req.method} ${req.originalUrl ?? req.url}: ${name}${suffix}`)
    if (res.headersSent) return
    res.status(500).json({ error: 'internal error' })
  })
}
