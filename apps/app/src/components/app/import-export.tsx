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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { Upload, Download, FileUp } from "lucide-react"

export function ImportDialog({
  workspaceSlug,
  target,
  label,
}: {
  workspaceSlug: string
  target: string
  label: string
}) {
  const [open, setOpen] = React.useState(false)
  const [stage, setStage] = React.useState<"upload" | "preview" | "result">("upload")
  const [file, setFile] = React.useState<File | null>(null)
  const [headers, setHeaders] = React.useState<string[]>([])
  const [sample, setSample] = React.useState<Record<string, string>[]>([])
  const [mapping, setMapping] = React.useState<Record<string, string>>({})
  const [suggested, setSuggested] = React.useState<Record<string, string>>({})
  const [errors, setErrors] = React.useState<string[]>([])
  const [result, setResult] = React.useState<{
    created: number
    updated: number
    skipped: number
    errored: number
  } | null>(null)
  const [pending, setPending] = React.useState(false)
  const router = useRouter()

  function reset() {
    setStage("upload")
    setFile(null)
    setHeaders([])
    setSample([])
    setMapping({})
    setSuggested({})
    setErrors([])
    setResult(null)
  }

  async function onUpload() {
    if (!file) return
    setPending(true)
    try {
      const fd = new FormData()
      fd.set("workspaceSlug", workspaceSlug)
      fd.set("target", target)
      fd.set("file", file)
      const res = await fetch("/api/imports/preview", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Preview failed")
      }
      const data = await res.json()
      setHeaders(data.headers)
      setSample(data.sampleRows)
      setSuggested(data.suggestedMapping)
      setMapping(data.suggestedMapping)
      setErrors(data.errors ?? [])
      setStage("preview")
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed")
    } finally {
      setPending(false)
    }
  }

  async function onExecute() {
    if (!file) return
    setPending(true)
    try {
      const fd = new FormData()
      fd.set("workspaceSlug", workspaceSlug)
      fd.set("target", target)
      fd.set("mapping", JSON.stringify(mapping))
      fd.set("file", file)
      const res = await fetch("/api/imports/execute", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Import failed")
      }
      const data = await res.json()
      setResult(data)
      setStage("result")
      toast.success(`Imported: ${data.created} created, ${data.updated} updated`)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="mr-1 h-3 w-3" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {label}</DialogTitle>
        </DialogHeader>
        {stage === "upload" && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
            </label>
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <Button onClick={onUpload} disabled={!file || pending} size="sm">
              <FileUp className="mr-1 h-3.5 w-3.5" /> {pending ? "Previewing…" : "Preview"}
            </Button>
          </div>
        )}
        {stage === "preview" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Map CSV columns to {label} fields. Suggested mapping shown — adjust if needed.
            </p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-2 items-center gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5">{h}</code>
                  <span className="text-muted-foreground">→</span>
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                    className="h-7 col-span-1 rounded border border-input bg-transparent px-2 text-xs"
                  >
                    <option value="">— Skip —</option>
                    {Object.values(suggested).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {sample.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Sample rows ({sample.length})
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
                  {JSON.stringify(sample, null, 2)}
                </pre>
              </details>
            )}
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>{errors.join("; ")}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Back
              </Button>
              <Button onClick={onExecute} disabled={pending} size="sm">
                {pending ? "Importing…" : "Execute import"}
              </Button>
            </div>
          </div>
        )}
        {stage === "result" && result && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-2xl font-semibold text-emerald-600">{result.created}</div>
                <div className="text-xs text-muted-foreground">Created</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-blue-600">{result.updated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-muted-foreground">{result.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-red-600">{result.errored}</div>
                <div className="text-xs text-muted-foreground">Errored</div>
              </div>
            </div>
            <DialogClose asChild>
              <Button className="w-full" onClick={reset}>
                Done
              </Button>
            </DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ExportButton({
  workspaceSlug,
  endpoint,
  label,
}: {
  workspaceSlug: string
  endpoint: string
  label: string
}) {
  const [pending, setPending] = React.useState(false)
  const router = useRouter()

  async function onExport() {
    setPending(true)
    try {
      // Audit endpoint expects different name for time-entries vs others
      const apiEndpoint = endpoint === "time-entries" ? "time-entries" : endpoint
      const res = await fetch(`/api/exports/${apiEndpoint}?ws=${workspaceSlug}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Export failed")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement("a")
      a.href = url
      a.download = `${endpoint}-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      const count = res.headers.get("X-Export-Count") ?? "?"
      toast.success(`Exported ${count} rows`)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={onExport} disabled={pending}>
      <Download className="mr-1 h-3 w-3" /> {pending ? "Exporting…" : "Export"}
    </Button>
  )
}
