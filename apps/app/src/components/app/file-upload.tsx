"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Paperclip, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/** Mirrors MAX_SIZE_BYTES in apps/app/src/lib/storage.ts. */
const MAX_SIZE_BYTES = 100 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Uploads a file and attaches it to a record.
 *
 * The storage backend — validation, checksums, tenant-scoped object paths,
 * signed download URLs — has been complete since the original build and had no
 * caller: there was no upload control anywhere in the application, so an
 * agency could not put a file in front of a client at all.
 *
 * Uses XMLHttpRequest rather than fetch because fetch still cannot report
 * upload progress, and a 100 MB video with no feedback reads as a hang.
 */
export function FileUploadDialog({
  workspaceSlug,
  entityType,
  entityId,
  trigger,
  allowClientVisible = true,
}: {
  workspaceSlug: string
  entityType: string
  entityId: string
  trigger: React.ReactNode
  /** Client-visible uploads only make sense where a client can reach them. */
  allowClientVisible?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [visibility, setVisibility] = React.useState<"internal" | "client">("internal")
  const [progress, setProgress] = React.useState(0)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setProgress(0)
    setError(null)
    setUploading(false)
    setVisibility("internal")
    if (inputRef.current) inputRef.current.value = ""
  }

  function onSelect(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const chosen = event.target.files?.[0] ?? null
    if (chosen && chosen.size > MAX_SIZE_BYTES) {
      // Checked here as well as on the server so a 100 MB upload is not sent
      // across the wire only to be rejected on arrival.
      setError(`That file is ${formatBytes(chosen.size)}. The limit is 100 MB.`)
      setFile(null)
      return
    }
    setFile(chosen)
  }

  function onUpload() {
    if (!file) return
    setError(null)
    setUploading(true)
    setProgress(0)

    const body = new FormData()
    body.set("workspaceSlug", workspaceSlug)
    body.set("entityType", entityType)
    body.set("entityId", entityId)
    body.set("visibility", visibility)
    body.set("file", file)

    const request = new XMLHttpRequest()
    request.open("POST", "/api/uploads/sign")

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    request.addEventListener("load", () => {
      setUploading(false)
      if (request.status >= 200 && request.status < 300) {
        setOpen(false)
        reset()
        router.refresh()
        return
      }
      let message = "Upload failed."
      try {
        message = JSON.parse(request.responseText)?.error ?? message
      } catch {
        // Non-JSON error body (a proxy timeout page, say). Keep the default.
      }
      setError(message)
    })

    request.addEventListener("error", () => {
      setUploading(false)
      setError("Upload failed. Check your connection and try again.")
    })

    request.addEventListener("abort", () => {
      setUploading(false)
      setError("Upload cancelled.")
    })

    request.send(body)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-upload would leave the request running invisibly.
        if (uploading) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a file</DialogTitle>
          <DialogDescription>
            Up to 100 MB. Images, PDFs, documents, spreadsheets, audio and video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="file-upload-input">File</Label>
            <input
              ref={inputRef}
              id="file-upload-input"
              type="file"
              onChange={onSelect}
              disabled={uploading}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border/60 file:bg-muted/40 file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            {file && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                <span className="truncate">{file.name}</span>
                <span>· {formatBytes(file.size)}</span>
                {!uploading && (
                  <button
                    type="button"
                    onClick={reset}
                    className="ml-1 rounded p-0.5 hover:bg-accent"
                    aria-label="Remove selected file"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </p>
            )}
          </div>

          {allowClientVisible && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Who can see this</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="visibility"
                  value="internal"
                  checked={visibility === "internal"}
                  onChange={() => setVisibility("internal")}
                  disabled={uploading}
                />
                Internal only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="visibility"
                  value="client"
                  checked={visibility === "client"}
                  onChange={() => setVisibility("client")}
                  disabled={uploading}
                />
                Visible to the client in their portal
              </label>
            </fieldset>
          )}

          {uploading && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Uploading… {progress}%
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onUpload} disabled={!file || uploading}>
            <Upload className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
