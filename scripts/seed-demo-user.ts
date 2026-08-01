/**
 * Demo data is created through Supabase Auth plus RLS-scoped seed tooling.
 * This legacy SQLite entry point is intentionally gone; use `supabase db
 * reset` and an authenticated seed job in a non-production project.
 */
console.error(
  "AgencyOS no longer supports Prisma/SQLite demo seeding. Use Supabase seed tooling in a non-production project."
)
process.exitCode = 1
