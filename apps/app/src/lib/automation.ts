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

import { serviceDb, serviceRpc, rpc } from "@/lib/db"
import { createServiceClient } from "@/lib/supabase/server"
import { evaluateConditionTree } from "@agencyos/domain"
import { sendEmail, sendWebhook } from "@/lib/delivery"

export interface OutboxEventPayload {
  eventType: string
  entityType: string
  entityId: string
  actorUserId?: string
  workspaceId: string
  metadata?: Record<string, unknown>
}

type OutboxRow = OutboxEventPayload & {
  id: string
  attempts: number
  payload?: Record<string, unknown> | null
  processedAt?: string | null
  nextAttemptAt?: string | null
  lockedAt?: string | null
}

type AutomationAction = { id: string; actionType: string; configJson?: unknown }

/**
 * Attempts before an event moves to the dead-letter state. Must match the
 * p_max_attempts default in public.fail_outbox_event (migration 0023); it is
 * passed explicitly on every call so the two cannot drift apart silently.
 */
const MAX_OUTBOX_ATTEMPTS = 5

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * Enqueue an outbox event. Called from server actions on every meaningful mutation.
 */
export async function emitEvent(payload: OutboxEventPayload) {
  await rpc("enqueue_outbox_event", {
    p_workspace_id: payload.workspaceId,
    p_event_type: payload.eventType,
    p_entity_type: payload.entityType,
    p_entity_id: payload.entityId,
    p_actor_user_id: payload.actorUserId ?? null,
    p_payload: payload.metadata ?? {},
  })
}

/**
 * Process outbox events. Called by /api/cron/process-outbox (CRON_SECRET gated).
 * Returns counts of processed, matched, succeeded, failed.
 */
export async function processOutbox(batchSize = 50) {
  if (!createServiceClient()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")

  const claimed = await serviceRpc<Record<string, unknown>[]>("claim_outbox_events", {
    p_limit: batchSize,
  })
  const events: OutboxRow[] = claimed.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    eventType: String(row.event_type),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : "",
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : undefined,
    payload: record(row.payload),
    attempts: Number(row.attempts ?? 0),
  }))

  let processed = 0
  let matched = 0
  let succeeded = 0
  let failed = 0
  let deadLettered = 0

  for (const event of events) {
    processed += 1
    try {
      const automations = await serviceDb.automation.findMany({
        where: {
          workspaceId: event.workspaceId,
          enabled: true,
          triggerType: event.eventType,
        },
        include: { actions: true },
      })

      if (event.eventType === "invitation.created") {
        const invitation = record(event.payload)
        await sendEmail({
          to: String(invitation.email ?? ""),
          subject: "You have been invited to AgencyOS",
          text: `You have been invited to join a workspace. Open this link to accept: ${String(invitation.inviteUrl ?? "")}`,
        })
      }

      for (const auto of automations) {
        if (!evaluateConditionTree(auto.conditionTreeJson, event)) continue
        matched += 1
        const idempotencyKey = `${auto.id}-${event.id}`
        const existing = await serviceDb.automationRun.findFirst({ where: { idempotencyKey } })
        if (existing?.status === "succeeded") continue

        const run =
          existing ??
          (await serviceDb.automationRun.create({
            data: {
              automationId: auto.id,
              triggerEventId: event.id,
              status: "running",
              idempotencyKey,
            },
          }))
        if (existing)
          await serviceDb.automationRun.update({
            where: { id: run.id },
            data: { status: "running", errorSummary: null, completedAt: null },
          })

        try {
          for (const action of auto.actions) {
            const prior = await serviceDb.automationActionRun.findFirst({
              where: { runId: run.id, actionId: action.id },
            })
            if (prior?.status === "succeeded") continue
            const actionRun =
              prior ??
              (await serviceDb.automationActionRun.create({
                data: { runId: run.id, actionId: action.id, status: "pending", attempts: 0 },
              }))
            try {
              await executeAction(event, action)
              await serviceDb.automationActionRun.update({
                where: { id: actionRun.id },
                data: { status: "succeeded", attempts: actionRun.attempts + 1, errorSummary: null },
              })
            } catch (error) {
              await serviceDb.automationActionRun.update({
                where: { id: actionRun.id },
                data: {
                  status: "failed",
                  attempts: actionRun.attempts + 1,
                  errorSummary: error instanceof Error ? error.message : "Automation action failed",
                },
              })
              throw error
            }
          }
          await serviceDb.automationRun.update({
            where: { id: run.id },
            data: { status: "succeeded", completedAt: new Date() },
          })
          succeeded += 1
        } catch (error) {
          const message = error instanceof Error ? error.message : "Automation action failed"
          await serviceDb.automationRun.update({
            where: { id: run.id },
            // attempts is incremented by claim_outbox_events, so it is already
            // the current attempt number rather than the previous one.
            data: {
              status: event.attempts >= MAX_OUTBOX_ATTEMPTS ? "dead_letter" : "failed",
              completedAt: new Date(),
              errorSummary: message,
            },
          })
          failed += 1
        }
      }

      await serviceRpc("complete_outbox_event", { p_event_id: event.id })
    } catch (error) {
      // This catch previously discarded the error object entirely: it recorded
      // a generic backoff and logged nothing, so a systematically failing
      // integration was invisible outside the database. Keep the message, on
      // the row and in the log.
      const message = error instanceof Error ? error.message : "Outbox processing failed"

      const outcome = await serviceRpc<string>("fail_outbox_event", {
        p_event_id: event.id,
        p_error: message,
        p_max_attempts: MAX_OUTBOX_ATTEMPTS,
      })

      if (outcome === "dead_letter") {
        deadLettered += 1
        console.error(
          `[outbox] event ${event.id} (${event.eventType}) dead-lettered after ${event.attempts} attempts: ${message}`
        )
      } else {
        console.warn(
          `[outbox] event ${event.id} (${event.eventType}) failed on attempt ${event.attempts}, will retry: ${message}`
        )
      }
      failed += 1
    }
  }

  return { processed, matched, succeeded, failed, deadLettered }
}

async function executeAction(event: OutboxRow, action: AutomationAction) {
  const config = record(action.configJson)
  switch (action.actionType) {
    case "create_record": {
      const entityType = String(config.entityType ?? "")
      const data = record(config.data)
      if (entityType === "task") {
        await serviceDb.task.create({
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
      const entityType = String(config.entityType ?? "")
      const entityId = String(config.entityId ?? "")
      const assigneeId = config.assigneeId ?? null
      if (entityType === "task") {
        await serviceDb.task.updateMany({
          where: { id: entityId, workspaceId: event.workspaceId },
          data: { assigneeId },
        })
      }
      break
    }
    case "notify": {
      const userId = String(config.userId ?? "")
      const title = String(config.title ?? "Automation notification")
      const body = config.body ? String(config.body) : null
      if (!userId) throw new Error("notify action requires userId")
      await serviceDb.notification.create({
        data: {
          workspaceId: event.workspaceId,
          userId,
          type: "automation",
          title,
          body,
          entityType: event.entityType,
          entityId: event.entityId,
        },
      })
      break
    }
    case "email": {
      const to = String(config.to ?? record(event.payload).email ?? "")
      const subject = String(config.subject ?? "AgencyOS notification")
      const text = String(config.text ?? config.body ?? "")
      await sendEmail({ to, subject, text })
      break
    }
    case "task": {
      const name = String(config.name ?? "Automated task")
      const assigneeId = config.assigneeId ?? null
      const projectId = config.projectId ?? null
      await serviceDb.task.create({
        data: {
          workspaceId: event.workspaceId,
          name,
          assigneeId,
          projectId: projectId ?? null,
          ownerId: event.actorUserId,
        },
      })
      break
    }
    case "webhook": {
      const url = String(config.url ?? "")
      const secret = String(config.secret ?? process.env.WEBHOOK_SIGNING_SECRET ?? "")
      if (!secret) throw new Error("Webhook signing secret is not configured")
      await sendWebhook(
        url,
        {
          eventType: event.eventType,
          entityType: event.entityType,
          entityId: event.entityId,
          workspaceId: event.workspaceId,
          payload: event.payload ?? {},
        },
        secret
      )
      break
    }
    default:
      throw new Error(`Unsupported automation action: ${action.actionType}`)
  }
}
