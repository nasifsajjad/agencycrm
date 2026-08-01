"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { inviteMemberAction, revokeInvitationAction, removeMemberAction } from "@/lib/crm-actions"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function InviteMemberDialog({
  workspaceSlug,
  roles,
  trigger,
}: {
  workspaceSlug: string
  roles: { id: string; name: string }[]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [inviteResult, setInviteResult] = React.useState<{ email: string; token: string } | null>(
    null
  )
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await inviteMemberAction(workspaceSlug, new FormData(e.currentTarget))
      if (res?.error) {
        setError(res.error)
        return
      }
      const data = (res as any)?.data
      if (data?.token) {
        setInviteResult({ email: data.email ?? "", token: data.token })
      }
      toast.success("Invitation sent")
      router.refresh()
      ;(e.target as HTMLFormElement).reset()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setInviteResult(null)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
        </DialogHeader>
        {inviteResult ? (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                <strong>One-time invite link:</strong> Share it securely with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{inviteResult.email}</code>:
              </AlertDescription>
            </Alert>
            <div className="rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-xs break-all">
              {typeof window !== "undefined"
                ? `${window.location.origin}/accept-invite?token=${inviteResult.token}`
                : `/accept-invite?token=${inviteResult.token}`}
            </div>
            <Button
              onClick={() => {
                setOpen(false)
                setInviteResult(null)
              }}
              className="w-full"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue="Team Member"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function RevokeInvitationButton({
  workspaceSlug,
  id,
  email,
}: {
  workspaceSlug: string
  id: string
  email: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-danger">
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
          <AlertDialogDescription>
            This will invalidate the invitation sent to {email}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault()
              setPending(true)
              try {
                const res = await revokeInvitationAction(workspaceSlug, id)
                if (res?.error) {
                  toast.error(res.error)
                  return
                }
                toast.success("Invitation revoked")
                router.refresh()
              } finally {
                setPending(false)
              }
            }}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function RemoveMemberButton({
  workspaceSlug,
  membershipId,
  memberName,
}: {
  workspaceSlug: string
  membershipId: string
  memberName: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-danger">
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {memberName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will lose access to this workspace immediately. The owner cannot be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault()
              setPending(true)
              try {
                const res = await removeMemberAction(workspaceSlug, membershipId)
                if (res?.error) {
                  toast.error(res.error)
                  return
                }
                toast.success("Member removed")
                router.refresh()
              } finally {
                setPending(false)
              }
            }}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
