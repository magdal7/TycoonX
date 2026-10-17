import type { PrismaClient } from '@prisma/client'

export type RegistrationConflict = 'email' | 'username' | null

/**
 * Case-insensitive duplicate detection for registration. The live unique indexes
 * on "email"/"username" are case-sensitive, so this guards against
 * "Alice"/"alice"-style duplicates at the application level until the
 * case-insensitive database index (Phase 6B.2A migration) is applied.
 */
export async function findRegistrationConflict(
  prisma: PrismaClient,
  input: { email: string; username: string },
): Promise<RegistrationConflict> {
  const emailTaken = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    select: { id: true },
  })
  if (emailTaken) return 'email'

  const usernameTaken = await prisma.user.findFirst({
    where: { username: { equals: input.username, mode: 'insensitive' } },
    select: { id: true },
  })
  if (usernameTaken) return 'username'

  return null
}
