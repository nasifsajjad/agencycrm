export type AutomationEvent = {
  eventType: string
  entityType: string
  entityId: string
  workspaceId: string
  actorUserId?: string
  payload?: Record<string, unknown> | null
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function pathValue(input: JsonRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => record(value)[part], input)
}

function comparable(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null
}

/** Evaluates the persisted automation condition grammar without treating missing values as strings. */
export function evaluateConditionTree(tree: unknown, event: AutomationEvent): boolean {
  if (tree === null || tree === undefined) return true
  if (Array.isArray(tree)) return tree.every((item) => evaluateConditionTree(item, event))
  const node = record(tree)
  if (Array.isArray(node.all)) return node.all.every((item) => evaluateConditionTree(item, event))
  if (Array.isArray(node.any)) return node.any.some((item) => evaluateConditionTree(item, event))
  if (node.not !== undefined) return !evaluateConditionTree(node.not, event)
  const field = typeof node.field === "string" ? node.field : null
  if (!field) throw new Error("Automation condition is missing field")
  const input = { ...event, ...record(event.payload), payload: event.payload ?? {} }
  const actual = pathValue(input, field)
  const operator = typeof node.operator === "string" ? node.operator : "equals"
  const expected = node.value
  const actualComparable = comparable(actual)
  const expectedComparable = comparable(expected)
  switch (operator) {
    case "exists":
      return actual !== null && actual !== undefined
    case "not_exists":
      return actual === null || actual === undefined
    case "equals":
      return actual === expected
    case "not_equals":
      return actual !== expected
    case "in":
      return Array.isArray(expected) && expected.includes(actual)
    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual)
    case "contains":
      return (
        actual !== null &&
        actual !== undefined &&
        String(actual)
          .toLowerCase()
          .includes(String(expected ?? "").toLowerCase())
      )
    case "starts_with":
      return (
        actual !== null &&
        actual !== undefined &&
        String(actual)
          .toLowerCase()
          .startsWith(String(expected ?? "").toLowerCase())
      )
    case "ends_with":
      return (
        actual !== null &&
        actual !== undefined &&
        String(actual)
          .toLowerCase()
          .endsWith(String(expected ?? "").toLowerCase())
      )
    case "lt":
      return (
        actualComparable !== null &&
        expectedComparable !== null &&
        actualComparable < expectedComparable
      )
    case "lte":
      return (
        actualComparable !== null &&
        expectedComparable !== null &&
        actualComparable <= expectedComparable
      )
    case "gt":
      return (
        actualComparable !== null &&
        expectedComparable !== null &&
        actualComparable > expectedComparable
      )
    case "gte":
      return (
        actualComparable !== null &&
        expectedComparable !== null &&
        actualComparable >= expectedComparable
      )
    default:
      throw new Error(`Unsupported automation condition operator: ${operator}`)
  }
}

export * from "./pagination"
