/**
 * Duck-typed check for Prisma's "unique constraint violation" error code
 * (P2002) - not imported from the generated Prisma Client (which may not
 * exist yet in every environment this code runs in, see the various
 * PrismaService files' comments on the sandbox's `prisma generate`
 * limitation), so this works regardless of whether the client has been
 * generated, and is exercisable by mocked-client tests without needing
 * the real PrismaClientKnownRequestError class.
 *
 * Originally written once in User Service's PrismaUserRepository, then
 * duplicated into Product Catalog Service's repositories - consolidated
 * here since every future Prisma-backed repository in this project will
 * need the same check.
 */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
