import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
;(async () => {
  await db.session.deleteMany()
  await db.auditEvent.deleteMany()
  await db.notification.deleteMany()
  await db.activityEvent.deleteMany()
  await db.invitation.deleteMany()
  await db.workspaceMembership.deleteMany()
  await db.workspace.deleteMany()
  await db.user.deleteMany()
  console.log("Wiped all tenant data.")
})()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
