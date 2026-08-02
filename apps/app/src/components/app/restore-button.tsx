"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { restoreCompanyAction, restoreContactAction } from "@/lib/crm-actions"

type RestorableEntity = "contact" | "company"

const RESTORE_ACTIONS: Record<
  RestorableEntity,
  (slug: string, id: string) => Promise<{ ok?: true; data?: unknown; error?: string }>
> = {
  contact: restoreContactAction,
  company: restoreCompanyAction,
}

/**
 * Restores one archived record.
 *
 * Restore is a safe, reversible action, so it does not sit behind a
 * confirmation dialog — the destructive direction is the one that already has
 * one.
 */
export function RestoreButton({
  workspaceSlug,
  entity,
  id,
  label,
}: {
  workspaceSlug: string
  entity: RestorableEntity
  id: string
  label: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onRestore() {
    setError(null)
    setPending(true)
    try {
      const result = await RESTORE_ACTIONS[entity](workspaceSlug, id)
      if (result?.error) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore this record.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onRestore}
        disabled={pending}
        aria-label={`Restore ${label}`}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        {pending ? "Restoring…" : "Restore"}
      </Button>
    </div>
  )
}
