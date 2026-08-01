import { describe, expect, it } from "vitest"
import { evaluateConditionTree } from "@agencyos/domain"

const event = {
  eventType: "deal.updated",
  entityType: "deal",
  entityId: "deal-a",
  workspaceId: "workspace-a",
  payload: { stage: "won", amountMinor: 12500, owner: { team: "sales" } },
}

describe("automation condition evaluation", () => {
  it("evaluates nested all/any groups and typed comparisons", () => {
    expect(evaluateConditionTree({ all: [
      { field: "stage", operator: "equals", value: "won" },
      { any: [
        { field: "amountMinor", operator: "gte", value: 10000 },
        { field: "owner.team", operator: "equals", value: "operations" },
      ] },
    ] }, event)).toBe(true)
  })

  it("distinguishes missing, null, and false values", () => {
    expect(evaluateConditionTree({ field: "payload.missing", operator: "not_exists" }, event)).toBe(true)
    expect(evaluateConditionTree({ field: "payload.stage", operator: "not_equals", value: "lost" }, event)).toBe(true)
    expect(evaluateConditionTree({ not: { field: "payload.stage", operator: "equals", value: "won" } }, event)).toBe(false)
  })

  it("rejects unknown operators instead of treating them as a match", () => {
    expect(() => evaluateConditionTree({ field: "stage", operator: "regex", value: "won" }, event)).toThrow("Unsupported")
  })
})
