// One-shot: create a demo user + workspace + load demo data, so the app has something to show.
// Run with: bun /home/z/my-project/scripts/seed-demo-user.ts

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcryptjs"
import { bootstrapWorkspace } from "../src/lib/workspace"
import { seedDemoAgency } from "../src/lib/seed"

const db = new PrismaClient()

async function main() {
  const email = "avery@agencyos.dev"
  const existing = await db.user.findUnique({ where: { emailNormalized: email } })
  if (existing) {
    console.log(`User ${email} already exists. Skipping.`)
    console.log(`Sign in at http://localhost:3000/sign-in`)
    console.log(`  email: ${email}`)
    console.log(`  password: demo-pass-12345`)
    console.log(`Workspace slug: northstar`)
    return
  }
  const passwordHash = await bcrypt.hash("demo-pass-12345", 10)
  const user = await db.user.create({
    data: {
      email,
      emailNormalized: email,
      passwordHash,
      displayName: "Avery Chen",
    },
  })

  const { workspaceId } = await bootstrapWorkspace({
    name: "Northstar Growth Studio",
    slug: "northstar",
    ownerId: user.id,
  })

  await seedDemoAgency(workspaceId, user.id)

  console.log("Demo user created.")
  console.log(`Sign in at http://localhost:3000/sign-in`)
  console.log(`  email: ${email}`)
  console.log(`  password: demo-pass-12345`)
  console.log(`Workspace URL: http://localhost:3000/w/northstar`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
