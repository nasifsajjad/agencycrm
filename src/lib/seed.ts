import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

/**
 * Seed a fictional demo agency into a freshly-bootstrapped workspace.
 * Northstar Growth Studio: 1 owner, plus demo members, clients, deals, projects,
 * tasks, approvals, time entries, and finance records.
 *
 * Demo users are created with deterministic credentials for easy local testing:
 *   email: <role>@northstar.demo
 *   password: demo-pass-12345
 *
 * SAFETY: this function is a no-op when NODE_ENV === 'production'.
 * Demo credentials must never be enabled automatically in production.
 * Operators who explicitly want demo data in a non-production environment
 * must invoke `bun run scripts/seed-demo-user.ts` manually.
 */

const DEMO_DISABLED =
  process.env.NODE_ENV === "production" && process.env.AGENCYOS_ALLOW_DEMO_SEED !== "1"

const DEMO_PASSWORD_HASH_PROMISE = DEMO_DISABLED
  ? Promise.resolve("DEMO_DISABLED")
  : hashPassword("demo-pass-12345")

async function ensureDemoUser(email: string, displayName: string) {
  if (DEMO_DISABLED) {
    throw new Error(
      "Demo seeding is disabled in production. Set AGENCYOS_ALLOW_DEMO_SEED=1 to override."
    )
  }
  const existing = await db.user.findUnique({ where: { emailNormalized: email } })
  if (existing) return existing
  const passwordHash = await DEMO_PASSWORD_HASH_PROMISE
  return db.user.create({
    data: {
      email,
      emailNormalized: email,
      displayName,
      passwordHash,
    },
  })
}

async function assignRole(workspaceId: string, membershipId: string, roleName: string) {
  const role = await db.role.findUnique({
    where: { workspaceId_name: { workspaceId, name: roleName } },
  })
  if (!role) return
  const exists = await db.membershipRole.findUnique({
    where: { membershipId_roleId: { membershipId, roleId: role.id } },
  })
  if (!exists) {
    await db.membershipRole.create({
      data: { membershipId, roleId: role.id },
    })
  }
}

export async function seedDemoAgency(workspaceId: string, ownerId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) throw new Error("Workspace not found")

  // Demo members (sales, AM, contributor, contractor, client)
  const salesUser = await ensureDemoUser("sarah@northstar.demo", "Sarah Patel")
  const amUser = await ensureDemoUser("marcus@northstar.demo", "Marcus Lee")
  const contributorUser = await ensureDemoUser("jordan@northstar.demo", "Jordan Kim")
  const contractorUser = await ensureDemoUser("rio@northstar.demo", "Rio Tanaka")
  const clientUser = await ensureDemoUser("alex@aurora.demo", "Alex Morrow")

  // Memberships
  for (const [user, role, title] of [
    [salesUser, "Sales", "Account Executive"],
    [amUser, "Account Manager", "Senior AM"],
    [contributorUser, "Team Member", "Designer"],
    [contractorUser, "Contractor", "Freelance Copywriter"],
  ] as const) {
    const membership = await db.workspaceMembership.create({
      data: { workspaceId, userId: user.id, status: "active", title },
    })
    await assignRole(workspaceId, membership.id, role)
  }

  // Client portal user — they get a Client role on a specific client (handled via portal)
  // The client user is NOT a workspace member; they only access the portal.

  // Pipelines and stages already created by bootstrap. Add some deals.
  const pipeline = await db.pipeline.findFirstOrThrow({ where: { workspaceId, isDefault: true } })
  const stages = await db.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { position: "asc" },
  })

  // Companies + contacts + clients
  const clients = [
    {
      company: {
        name: "Aurora Skincare",
        domain: "auroraskin.com",
        industry: "Consumer Goods",
        sizeBand: "51-200",
      },
      contact: {
        firstName: "Alex",
        lastName: "Morrow",
        email: "alex@auroraskin.com",
        jobTitle: "VP Marketing",
      },
      client: {
        name: "Aurora Skincare",
        code: "AUR",
        status: "active",
        healthScore: 82,
        healthReason: "On-track retainer, expanding scope",
        portalEnabled: true,
        portalSlug: "aurora-portal",
        onboardingStatus: "complete",
        startDate: new Date("2025-09-01"),
        renewalDate: new Date("2026-09-01"),
      },
      deals: [
        { name: "Aurora — Q4 Holiday Campaign", amountMinor: 45000n, stageName: "Negotiation" },
        { name: "Aurora — Retainer expansion", amountMinor: 18000n, stageName: "Proposal" },
      ],
    },
    {
      company: {
        name: "Helix Health",
        domain: "helixhealth.io",
        industry: "Healthcare",
        sizeBand: "201-500",
      },
      contact: {
        firstName: "Priya",
        lastName: "Raman",
        email: "priya@helixhealth.io",
        jobTitle: "Director of Growth",
      },
      client: {
        name: "Helix Health",
        code: "HLX",
        status: "active",
        healthScore: 64,
        healthReason: "Approvals slow; renewal in 90 days",
        portalEnabled: true,
        portalSlug: "helix-portal",
        onboardingStatus: "complete",
        startDate: new Date("2025-04-15"),
        renewalDate: new Date("2026-04-15"),
      },
      deals: [{ name: "Helix — Brand refresh", amountMinor: 72000n, stageName: "Qualified" }],
    },
    {
      company: {
        name: "Northpoint SaaS",
        domain: "northpoint.app",
        industry: "SaaS",
        sizeBand: "11-50",
      },
      contact: {
        firstName: "Daniel",
        lastName: "Brooks",
        email: "daniel@northpoint.app",
        jobTitle: "CEO",
      },
      client: {
        name: "Northpoint SaaS",
        code: "NPT",
        status: "at_risk",
        healthScore: 38,
        healthReason: "Multiple missed approvals; budget concerns raised",
        portalEnabled: false,
        portalSlug: null,
        onboardingStatus: "complete",
        startDate: new Date("2025-02-01"),
        renewalDate: new Date("2026-02-01"),
      },
      deals: [{ name: "Northpoint — Lifecycle email", amountMinor: 28000n, stageName: "Lead" }],
    },
  ]

  for (const c of clients) {
    const company = await db.company.create({
      data: {
        workspaceId,
        name: c.company.name,
        domain: c.company.domain,
        industry: c.company.industry,
        sizeBand: c.company.sizeBand,
        ownerId: amUser.id,
        lifecycleStage: "customer",
      },
    })
    const contact = await db.contact.create({
      data: {
        workspaceId,
        companyId: company.id,
        firstName: c.contact.firstName,
        lastName: c.contact.lastName,
        email: c.contact.email,
        jobTitle: c.contact.jobTitle,
        ownerId: amUser.id,
        lifecycleStage: "customer",
        marketingConsent: true,
      },
    })
    const client = await db.client.create({
      data: {
        workspaceId,
        companyId: company.id,
        name: c.client.name,
        code: c.client.code,
        status: c.client.status,
        healthScore: c.client.healthScore,
        healthReason: c.client.healthReason,
        ownerId: amUser.id,
        portalEnabled: c.client.portalEnabled,
        portalSlug: c.client.portalSlug,
        onboardingStatus: c.client.onboardingStatus,
        startDate: c.client.startDate,
        renewalDate: c.client.renewalDate,
      },
    })
    await db.clientContact.create({
      data: {
        clientId: client.id,
        contactId: contact.id,
        relationshipRole: "Primary",
        isPrimary: true,
        portalAccess: c.client.portalEnabled,
      },
    })
    if (c.client.portalEnabled && c.client.portalSlug) {
      await db.clientPortal.create({
        data: {
          workspaceId,
          clientId: client.id,
          slug: c.client.portalSlug,
          contactId: contact.id,
          brandColor: "#4f46e5",
        },
      })
    }

    // Deals
    for (const d of c.deals) {
      const stage = stages.find((s) => s.name === d.stageName)
      await db.deal.create({
        data: {
          workspaceId,
          companyId: company.id,
          primaryContactId: contact.id,
          pipelineId: pipeline.id,
          stageId: stage?.id,
          name: d.name,
          amountMinor: d.amountMinor,
          currency: "USD",
          probability: stage?.probability ?? 0,
          ownerId: salesUser.id,
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }

  // Leads (raw prospect list)
  const leads = [
    {
      firstName: "Mira",
      lastName: "Chen",
      email: "mira@brightlabs.io",
      company: "Bright Labs",
      source: "Inbound",
      score: 78,
      status: "qualified",
    },
    {
      firstName: "Theo",
      lastName: "Adebayo",
      email: "theo@northwind.co",
      company: "Northwind Co",
      source: "Referral",
      score: 62,
      status: "new",
    },
    {
      firstName: "Lena",
      lastName: "Voss",
      email: "lena@meridian.eu",
      company: "Meridian Group",
      source: "Outbound",
      score: 45,
      status: "new",
    },
  ]
  for (const l of leads) {
    const company = await db.company.create({
      data: { workspaceId, name: l.company, ownerId: salesUser.id, lifecycleStage: "lead" },
    })
    const contact = await db.contact.create({
      data: {
        workspaceId,
        companyId: company.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        ownerId: salesUser.id,
        lifecycleStage: "lead",
      },
    })
    await db.lead.create({
      data: {
        workspaceId,
        contactId: contact.id,
        companyId: company.id,
        source: l.source,
        score: l.score,
        status: l.status,
        ownerId: salesUser.id,
        qualifiedAt: l.status === "qualified" ? new Date() : null,
      },
    })
  }

  // Projects + tasks + milestones + deliverables + approvals
  const auroraClient = await db.client.findFirst({ where: { workspaceId, code: "AUR" } })
  const helixClient = await db.client.findFirst({ where: { workspaceId, code: "HLX" } })
  const northpointClient = await db.client.findFirst({ where: { workspaceId, code: "NPT" } })

  if (auroraClient && helixClient && northpointClient) {
    const projectStatuses = await db.projectStatus.findMany({ where: { workspaceId } })
    const taskStatuses = await db.taskStatus.findMany({ where: { workspaceId } })
    const inProgressStatus = projectStatuses.find((s) => s.name === "In Progress")
    const planningStatus = projectStatuses.find((s) => s.name === "Planning")
    const todoStatus = taskStatuses.find((s) => s.name === "To Do")
    const inProgressTaskStatus = taskStatuses.find((s) => s.name === "In Progress")
    const inReviewStatus = taskStatuses.find((s) => s.name === "In Review")
    const doneStatus = taskStatuses.find((s) => s.name === "Done")

    // Project 1: Aurora holiday campaign
    const auroraProject = await db.project.create({
      data: {
        workspaceId,
        clientId: auroraClient.id,
        name: "Aurora Q4 Holiday Campaign",
        code: "AUR-001",
        description: "Full-funnel holiday campaign across paid social, email, and landing pages.",
        statusId: inProgressStatus?.id,
        ownerId: amUser.id,
        startDate: new Date("2026-10-01"),
        dueDate: new Date("2026-12-15"),
        budgetMinor: 60000n,
        currency: "USD",
        budgetMinutes: 4800,
        visibility: "client",
      },
    })
    await db.projectMember.create({
      data: {
        projectId: auroraProject.id,
        membershipId: (
          await db.workspaceMembership.findUniqueOrThrow({
            where: { workspaceId_userId: { workspaceId, userId: contributorUser.id } },
          })
        ).id,
        accessLevel: "editor",
      },
    })
    await db.projectMember.create({
      data: {
        projectId: auroraProject.id,
        membershipId: (
          await db.workspaceMembership.findUniqueOrThrow({
            where: { workspaceId_userId: { workspaceId, userId: contractorUser.id } },
          })
        ).id,
        accessLevel: "editor",
      },
    })

    const milestone1 = await db.milestone.create({
      data: {
        projectId: auroraProject.id,
        name: "Creative concepts approved",
        dueDate: new Date("2026-10-20"),
        status: "done",
      },
    })
    const milestone2 = await db.milestone.create({
      data: {
        projectId: auroraProject.id,
        name: "Production complete",
        dueDate: new Date("2026-11-15"),
        status: "in_progress",
      },
    })

    const tasks = [
      {
        name: "Moodboard v1",
        statusId: doneStatus?.id,
        milestoneId: milestone1.id,
        assigneeId: contributorUser.id,
        estimateMinutes: 240,
        dueAt: new Date("2026-10-08"),
      },
      {
        name: "Hero ad concepts (3)",
        statusId: doneStatus?.id,
        milestoneId: milestone1.id,
        assigneeId: contributorUser.id,
        estimateMinutes: 480,
        dueAt: new Date("2026-10-15"),
      },
      {
        name: "Email sequence copy",
        statusId: inReviewStatus?.id,
        milestoneId: milestone2.id,
        assigneeId: contractorUser.id,
        estimateMinutes: 360,
        dueAt: new Date("2026-11-01"),
      },
      {
        name: "Landing page design",
        statusId: inProgressTaskStatus?.id,
        milestoneId: milestone2.id,
        assigneeId: contributorUser.id,
        estimateMinutes: 600,
        dueAt: new Date("2026-11-08"),
      },
      {
        name: "Paid social ad set build",
        statusId: todoStatus?.id,
        milestoneId: milestone2.id,
        assigneeId: contractorUser.id,
        estimateMinutes: 180,
        dueAt: new Date("2026-11-12"),
      },
    ]
    for (const t of tasks) {
      await db.task.create({
        data: {
          workspaceId,
          projectId: auroraProject.id,
          milestoneId: t.milestoneId,
          name: t.name,
          statusId: t.statusId,
          assigneeId: t.assigneeId,
          ownerId: amUser.id,
          estimateMinutes: t.estimateMinutes,
          dueAt: t.dueAt,
          visibility: "client",
          priority: "high",
        },
      })
    }

    // Deliverables + versions + approvals
    const deliverable1 = await db.deliverable.create({
      data: {
        workspaceId,
        projectId: auroraProject.id,
        clientId: auroraClient.id,
        name: "Hero ad — Holiday 2026",
        type: "image",
        status: "in_review",
        dueAt: new Date("2026-10-22"),
        ownerId: contributorUser.id,
        visibility: "client",
      },
    })
    await db.deliverableVersion.create({
      data: {
        deliverableId: deliverable1.id,
        versionNumber: 1,
        notes: "Initial concept — three layout variants",
        createdById: contributorUser.id,
      },
    })
    await db.deliverableVersion.create({
      data: {
        deliverableId: deliverable1.id,
        versionNumber: 2,
        notes: "Refined per AM feedback — locked layout B",
        createdById: contributorUser.id,
      },
    })
    // Pending approval on v2
    const approval1 = await db.approvalRequest.create({
      data: {
        workspaceId,
        entityType: "deliverable",
        entityId: deliverable1.id,
        versionNumber: 2,
        title: "Hero ad — Holiday 2026 (v2)",
        instructions:
          "Please approve the refined hero ad for the holiday campaign. Locking layout B for production.",
        status: "pending",
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        requestedById: amUser.id,
      },
    })
    await db.approvalStep.create({
      data: {
        approvalRequestId: approval1.id,
        position: 0,
        approverType: "client_contact",
        approverId: (await db.contact.findFirstOrThrow({ where: { email: "alex@auroraskin.com" } }))
          .id,
        status: "pending",
      },
    })
    await db.approvalEvent.create({
      data: {
        approvalRequestId: approval1.id,
        actorUserId: amUser.id,
        action: "requested",
        note: "Requested client approval",
      },
    })

    // Project 2: Helix brand refresh
    const helixProject = await db.project.create({
      data: {
        workspaceId,
        clientId: helixClient.id,
        name: "Helix Brand Refresh",
        code: "HLX-001",
        description: "Visual identity refresh and brand guidelines.",
        statusId: inProgressStatus?.id,
        ownerId: amUser.id,
        startDate: new Date("2026-09-15"),
        dueDate: new Date("2027-01-30"),
        budgetMinor: 72000n,
        currency: "USD",
        budgetMinutes: 6000,
        visibility: "client",
      },
    })
    await db.projectMember.create({
      data: {
        projectId: helixProject.id,
        membershipId: (
          await db.workspaceMembership.findUniqueOrThrow({
            where: { workspaceId_userId: { workspaceId, userId: contributorUser.id } },
          })
        ).id,
        accessLevel: "editor",
      },
    })

    const helixTasks = [
      {
        name: "Brand audit",
        statusId: doneStatus?.id,
        assigneeId: contributorUser.id,
        estimateMinutes: 480,
        dueAt: new Date("2026-09-30"),
      },
      {
        name: "Logo system v1",
        statusId: inProgressTaskStatus?.id,
        assigneeId: contributorUser.id,
        estimateMinutes: 720,
        dueAt: new Date("2026-11-15"),
      },
      {
        name: "Color & type system",
        statusId: todoStatus?.id,
        assigneeId: contributorUser.id,
        estimateMinutes: 360,
        dueAt: new Date("2026-12-01"),
      },
    ]
    for (const t of helixTasks) {
      await db.task.create({
        data: {
          workspaceId,
          projectId: helixProject.id,
          name: t.name,
          statusId: t.statusId,
          assigneeId: t.assigneeId,
          ownerId: amUser.id,
          estimateMinutes: t.estimateMinutes,
          dueAt: t.dueAt,
          visibility: "client",
        },
      })
    }

    // Completed approval for demo
    const deliverable2 = await db.deliverable.create({
      data: {
        workspaceId,
        projectId: helixProject.id,
        clientId: helixClient.id,
        name: "Brand audit findings deck",
        type: "document",
        status: "approved",
        dueAt: new Date("2026-09-30"),
        ownerId: contributorUser.id,
        visibility: "client",
      },
    })
    await db.deliverableVersion.create({
      data: {
        deliverableId: deliverable2.id,
        versionNumber: 1,
        notes: "Initial findings",
        createdById: contributorUser.id,
      },
    })
    const approval2 = await db.approvalRequest.create({
      data: {
        workspaceId,
        entityType: "deliverable",
        entityId: deliverable2.id,
        versionNumber: 1,
        title: "Brand audit findings",
        status: "approved",
        requestedById: amUser.id,
        decidedAt: new Date("2026-10-02"),
      },
    })
    await db.approvalStep.create({
      data: {
        approvalRequestId: approval2.id,
        position: 0,
        approverType: "client_contact",
        approverId: (
          await db.contact.findFirstOrThrow({ where: { email: "priya@helixhealth.io" } })
        ).id,
        status: "approved",
        decidedAt: new Date("2026-10-02"),
        decisionNote: "Looks great — proceeding to logo system",
      },
    })
    await db.approvalEvent.create({
      data: {
        approvalRequestId: approval2.id,
        actorUserId: amUser.id,
        action: "approved",
        note: "Client approved",
      },
    })

    // Project 3: Northpoint lifecycle email (at-risk)
    const nptProject = await db.project.create({
      data: {
        workspaceId,
        clientId: northpointClient.id,
        name: "Northpoint Lifecycle Email",
        code: "NPT-001",
        description: "5-step lifecycle email automation.",
        statusId: planningStatus?.id,
        ownerId: amUser.id,
        startDate: new Date("2026-08-01"),
        dueDate: new Date("2026-11-30"),
        budgetMinor: 28000n,
        currency: "USD",
        budgetMinutes: 1800,
        visibility: "internal",
      },
    })
    await db.task.create({
      data: {
        workspaceId,
        projectId: nptProject.id,
        name: "Email 1 — Onboarding",
        statusId: inProgressTaskStatus?.id,
        assigneeId: contractorUser.id,
        ownerId: amUser.id,
        estimateMinutes: 180,
        dueAt: new Date("2026-09-15"),
        visibility: "internal",
      },
    })

    // Client requests
    await db.clientRequest.createMany({
      data: [
        {
          workspaceId,
          clientId: auroraClient.id,
          title: "Add SKU variants to holiday ad copy",
          priority: "normal",
          status: "new",
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          workspaceId,
          clientId: auroraClient.id,
          title: "Provide updated brand assets",
          priority: "high",
          status: "in_progress",
          dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        },
        {
          workspaceId,
          clientId: helixClient.id,
          title: "Schedule QBR for January",
          priority: "normal",
          status: "new",
        },
      ],
    })

    // Time entries
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    await db.timeEntry.createMany({
      data: [
        {
          workspaceId,
          projectId: auroraProject.id,
          clientId: auroraClient.id,
          userId: contributorUser.id,
          startedAt: twoDaysAgo,
          endedAt: new Date(twoDaysAgo.getTime() + 3 * 60 * 60 * 1000),
          minutes: 180,
          description: "Hero ad concepts v1",
          billable: true,
          rateMinor: 18000n,
          currency: "USD",
          status: "approved",
        },
        {
          workspaceId,
          projectId: auroraProject.id,
          clientId: auroraClient.id,
          userId: contractorUser.id,
          startedAt: yesterday,
          endedAt: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000),
          minutes: 120,
          description: "Email sequence copy",
          billable: true,
          rateMinor: 14000n,
          currency: "USD",
          status: "submitted",
        },
        {
          workspaceId,
          projectId: helixProject.id,
          clientId: helixClient.id,
          userId: contributorUser.id,
          startedAt: yesterday,
          endedAt: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000),
          minutes: 240,
          description: "Logo system v1",
          billable: true,
          rateMinor: 18000n,
          currency: "USD",
          status: "open",
        },
      ],
    })

    // Retainer for Aurora
    await db.retainer.create({
      data: {
        clientId: auroraClient.id,
        name: "Monthly retainer",
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-09-01"),
        amountMinor: 15000n,
        currency: "USD",
        includedMinutes: 2400,
        rolloverPolicy: "cap_20_percent",
        status: "active",
      },
    })

    // Service rate cards
    const services = await db.service.findMany({ where: { workspaceId } })
    for (const service of services) {
      await db.rateCard.create({
        data: {
          workspaceId,
          clientId: auroraClient.id,
          serviceId: service.id,
          rateMinor: service.defaultRateMinor,
          currency: "USD",
          startsOn: new Date("2025-09-01"),
        },
      })
    }

    // Expenses
    await db.expense.create({
      data: {
        workspaceId,
        clientId: auroraClient.id,
        projectId: auroraProject.id,
        category: "Stock photography",
        amountMinor: 12000n,
        currency: "USD",
        incurredOn: new Date(),
        billable: true,
        status: "submitted",
      },
    })

    // Invoice
    const invoice = await db.invoice.create({
      data: {
        workspaceId,
        clientId: auroraClient.id,
        number: "INV-2026-001",
        status: "sent",
        currency: "USD",
        issuedOn: new Date("2026-10-01"),
        dueOn: new Date("2026-10-31"),
        subtotalMinor: 15000n,
        taxMinor: 0n,
        totalMinor: 15000n,
        paidMinor: 0n,
      },
    })
    await db.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        description: "September retainer — Aurora Skincare",
        quantityDecimal: 1,
        unitPriceMinor: 15000n,
        taxRateDecimal: 0,
        projectId: auroraProject.id,
      },
    })

    // Client health events
    await db.clientHealthEvent.createMany({
      data: [
        {
          clientId: northpointClient.id,
          score: 38,
          reason: "Missed approval deadline",
          source: "manual",
          occurredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          clientId: helixClient.id,
          score: 64,
          reason: "Slow approval cycle",
          source: "manual",
          occurredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          clientId: auroraClient.id,
          score: 82,
          reason: "Renewal conversation positive",
          source: "manual",
          occurredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    })

    // Activity events
    await db.activityEvent.createMany({
      data: [
        {
          workspaceId,
          actorUserId: amUser.id,
          verb: "approval.requested",
          entityType: "deliverable",
          entityId: deliverable1.id,
          visibility: "client",
          occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          workspaceId,
          actorUserId: contributorUser.id,
          verb: "version.uploaded",
          entityType: "deliverable",
          entityId: deliverable1.id,
          visibility: "client",
          occurredAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
        {
          workspaceId,
          actorUserId: contractorUser.id,
          verb: "task.updated",
          entityType: "task",
          entityId: "demo-task-1",
          visibility: "internal",
          occurredAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
      ],
    })

    // Notifications for AM
    await db.notification.createMany({
      data: [
        {
          workspaceId,
          userId: amUser.id,
          type: "approval.requested",
          title: "New approval requested",
          body: "Hero ad — Holiday 2026 (v2)",
          entityType: "approval",
          entityId: approval1.id,
        },
        {
          workspaceId,
          userId: amUser.id,
          type: "task.due",
          title: "Task due soon",
          body: "Email sequence copy",
          entityType: "task",
        },
        {
          workspaceId,
          userId: amUser.id,
          type: "client.health",
          title: "Health update",
          body: "Northpoint SaaS dropped to 38",
          entityType: "client",
          entityId: northpointClient.id,
        },
      ],
    })

    // Comments
    await db.comment.create({
      data: {
        workspaceId,
        entityType: "deliverable",
        entityId: deliverable1.id,
        bodyRich: "Tagging @alex for review. Could we get feedback by EOD Thursday?",
        visibility: "client",
        authorId: amUser.id,
      },
    })
    await db.comment.create({
      data: {
        workspaceId,
        entityType: "deliverable",
        entityId: deliverable1.id,
        bodyRich: "Internal note: client has been slow on approvals. Keep this one tight.",
        visibility: "internal",
        authorId: contributorUser.id,
      },
    })

    // Saved views
    await db.savedView.create({
      data: {
        workspaceId,
        entityType: "deal",
        name: "My open deals",
        ownerId: salesUser.id,
        visibility: "private",
        queryJson: { owner: salesUser.id, stageCategory: "open" },
      },
    })

    // Dashboard with widgets
    const dashboard = await db.dashboard.create({
      data: { workspaceId, name: "Executive overview", visibility: "workspace" },
    })
    await db.dashboardWidget.createMany({
      data: [
        {
          dashboardId: dashboard.id,
          widgetType: "pipeline_value",
          positionJson: { x: 0, y: 0, w: 6, h: 1 },
        },
        {
          dashboardId: dashboard.id,
          widgetType: "active_clients",
          positionJson: { x: 6, y: 0, w: 6, h: 1 },
        },
        {
          dashboardId: dashboard.id,
          widgetType: "approvals_pending",
          positionJson: { x: 0, y: 1, w: 6, h: 1 },
        },
        {
          dashboardId: dashboard.id,
          widgetType: "utilization",
          positionJson: { x: 6, y: 1, w: 6, h: 1 },
        },
      ],
    })

    // Custom field
    const cf = await db.customFieldDefinition.create({
      data: {
        workspaceId,
        entityType: "client",
        key: "tier",
        label: "Client tier",
        dataType: "select",
        optionsJson: { options: ["Tier 1", "Tier 2", "Tier 3"] },
        position: 0,
        active: true,
      },
    })
    await db.customFieldValue.create({
      data: {
        definitionId: cf.id,
        workspaceId,
        entityType: "client",
        entityId: auroraClient.id,
        valueJson: "Tier 1",
      },
    })
    await db.customFieldValue.create({
      data: {
        definitionId: cf.id,
        workspaceId,
        entityType: "client",
        entityId: helixClient.id,
        valueJson: "Tier 2",
      },
    })

    // Knowledge page
    await db.knowledgePage.create({
      data: {
        workspaceId,
        title: "Agency onboarding playbook",
        slug: "onboarding-playbook",
        bodyRich:
          "# Agency onboarding\n\n1. Kickoff call\n2. Brand audit\n3. Tooling setup\n4. First sprint plan",
        visibility: "internal",
      },
    })
  }
}
