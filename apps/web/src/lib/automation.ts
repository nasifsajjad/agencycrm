/**
 * AgencyOS — Automation engine.
 *
 * Triggers: record created/updated, stage changed, due date, approval, form submission, schedule.
 * Actions: create/update record, assign, notify, email, task, webhook.
 *
 * Pattern: event inserted into outbox_events → worker picks up → matches
 * automations by trigger_type → evaluates condition tree → enqueues action
 * runs → executes with idempotency + retry + dead-letter.
 *
 * In this build, the worker runs on a schedule (cron-style endpoint) since
 * Supabase Queues aren't available without a live instance. Production
 * would use pg_cron + a Supabase Edge Function.
 */

import { db } from "@/lib/db"
import type { WorkspaceContext } from "@/lib/auth"

export interface OutboxEventPayload {
  eventType: string
  entityType: string
  entityId: string
  actorUserId?: string
  workspaceId: string
  metadata?: Record<string, unknown>
}

/**
 * Enqueue an outbox event. Called from server actions on every meaningful mutation.
 */
export async function emitEvent(payload: OutboxEventPayload) {
  await db.outboxEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      eventType: payload.eventType,
      entityType: payload.entityType,
      entityId: payload.entityId,
      actorUserId: payload.actorUserId ?? null,
      payload: payload.metadata as any,
    },
  })
}

/**
 * Process outbox events. Called by /api/cron/process-outbox (CRON_SECRET gated).
 * Returns counts of processed, matched, succeeded, failed.
 */
export async function processOutbox(batchSize = 50) {
  const events = await db.outboxEvent.findMany({
    where: { processedAt: null, nextAttemptAt: { lte: new Date() } },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  })

  let processed = 0
  let matched = 0
  let succeeded = 0
  let failed = 0

  for (const event of events) {
    processed += 1
    try {
      const automations = await db.automation.findMany({
        where: {
          workspaceId: event.workspaceId,
          enabled: true,
          triggerType: event.eventType,
        },
        include: { actions: true },
      })

      for (const auto of automations) {
        matched += 1
        const idempotencyKey = `${auto.id}-${event.id}`
        const existing = await db.automationRun.findFirst({ where: { idempotencyKey } })
        if (existing) continue

        const run = await db.automationRun.create({
          data: {
            automationId: auto.id,
            triggerEventId: event.id,
            status: "running",
            idempotencyKey,
          },
        })

        try {
          // Evaluate condition tree (simplified: skip if conditions not met)
          // For now, no conditions; production would parse conditionTreeJson
          for (const action of auto.actions) {
            await executeAction(event, action)
            await db.automationActionRun.create({
              data: {
                runId: run.id,
                actionId: action.id,
                status: "succeeded",
                attempts: 1,
              },
            })
          }
          await db.automationRun.update({
            where: { id: run.id },
            data: { status: "succeeded", completedAt: new Date() },
          })
          succeeded += 1
        } catch (e: any) {
          await db.automationRun.update({
            where: { id: run.id },
            data: { status: "failed", completedAt: new Date(), errorSummary: e?.message },
          })
          failed += 1
        }
      }

      await db.outboxEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      })
    } catch (e: any) {
      // Mark for retry with backoff
      const attempts = event.attempts + 1
      const backoff = Math.min(60 * Math.pow(2, attempts), 3600) * 1000
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts,
          nextAttemptAt: new Date(Date.now() + backoff),
        },
      })
      if (attempts >= 5) {
        await db.outboxEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        })
      }
      failed += 1
    }
  }

  return { processed, matched, succeeded, failed }
}

async function executeAction(event: any, action: any) {
  const config = (action.configJson as any) ?? {}
  switch (action.actionType) {
    case "create_record": {
      const { entityType, data } = config
      if (entityType === "task") {
        await db.task.create({
          data: {
            workspaceId: event.workspaceId,
            name: data.name ?? "Auto-created task",
            descriptionRich: data.description ?? null,
            ownerId: event.actorUserId,
            assigneeId: data.assigneeId ?? null,
            visibility: "internal",
          },
        })
      }
      break
    }
    case "assign": {
      const { entityType, entityId, assigneeId } = config
      if (entityType === "task") {
        await db.task.updateMany({
          where: { id: entityId, workspaceId: event.workspaceId },
          data: { assigneeId },
        })
      }
      break
    }
    case "notify": {
      const { userId, title, body } = config
      await db.notification.create({
        data: {
          workspaceId: event.workspaceId,
          userId,
          type: "automation",
          title: title ?? "Automation notification",
          body: body ?? null,
          entityType: event.entityType,
          entityId: event.entityId,
        },
      })
      break
    }
    case "email": {
      throw new Error("Email delivery adapter is not configured")
    }
    case "task": {
      const { name, assigneeId, projectId } = config
      await db.task.create({
        data: {
          workspaceId: event.workspaceId,
          name: name ?? "Automated task",
          assigneeId,
          projectId: projectId ?? null,
          ownerId: event.actorUserId,
        },
      })
      break
    }
    case "webhook": {
      throw new Error("Webhook delivery adapter is not configured")
    }
    default:
      // Unknown action — skip
      break
  }
}
