# Runbook — Stuck or failed jobs

## Symptom

`AutomationRun` or `WebhookDelivery` rows are stuck in `pending` or `running` status for longer than expected.

## Diagnosis

```sql
SELECT id, status, startedAt, completedAt, errorSummary
FROM AutomationRun
WHERE status IN ('pending', 'running')
  AND startedAt < datetime('now', '-1 hour')
ORDER BY startedAt ASC;
```

## Resolution

In the current sandbox build, there is no queue worker. Jobs created in the schema are not processed. If a worker is added later:

1. Inspect the `errorSummary` field for the failure reason.
2. If transient (network, rate limit), retry by setting `status = 'pending'` and incrementing `attempts`.
3. If permanent (logic error, schema mismatch), mark `status = 'dead_letter'` and notify the operator.
4. For `WebhookDelivery`, inspect `responseCode` — 4xx errors are usually not retryable; 5xx are.

## Prevention

- All jobs must be idempotent (use `idempotencyKey`).
- Max attempts should be enforced (default 5).
- Visibility timeout / lease prevents two workers from claiming the same job.

## Related

- ADR 0001 — Sandbox stack substitution (no worker in current build)
- `docs/CURRENT_STATE.md` — Automations marked as deferred
