/**
 * AgencyOS — Storage adapter.
 *
 * Supabase Storage is the binary source of truth and the `files` table stores
 * tenant-scoped metadata. Both operations use the request-scoped user client,
 * so storage.objects RLS is enforced in addition to application permissions.
 */

import path from "node:path"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import type { WorkspaceContext } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
])
const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

export interface UploadInput {
  ctx: WorkspaceContext
  bucket?: string
  originalName: string
  contentType: string
  sizeBytes: number
  body: Buffer
  entityType?: string
  entityId?: string
  visibility?: "internal" | "client" | "restricted"
}

export interface UploadResult {
  id: string
  bucket: string
  objectPath: string
  originalName: string
  contentType: string
  sizeBytes: number
  checksum: string
}

/**
 * Validate, store, and record a file upload.
 * Upload the binary first so a metadata row is never visible for a missing
 * object. The metadata insert is rolled back with a best-effort object delete
 * if PostgREST rejects the row.
 */
export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  // Validate MIME
  if (!ALLOWED_MIME.has(input.contentType) && !input.contentType.startsWith("image/")) {
    throw new Error(`Unsupported file type: ${input.contentType}`)
  }
  // Validate size
  if (input.sizeBytes > MAX_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_SIZE_BYTES / 1024 / 1024}MB`)
  }

  const bucket = input.bucket ?? "workspace-assets"
  const workspaceId = input.ctx.workspaceId
  const ext = path.extname(input.originalName).toLowerCase()
  const objectPath = `${workspaceId}/${randomUUID()}${ext}`
  const checksum = await computeChecksum(input.body)

  const supabase = await createServerClient()
  if (!supabase) throw new Error("Supabase is not configured")
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, input.body, {
      contentType: input.contentType,
      upsert: false,
    })
  if (uploadError) throw uploadError

  let file
  try {
    file = await db.fileRecord.create({
      data: {
        workspaceId,
        bucket,
        objectPath,
        originalName: input.originalName,
        contentType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        checksum,
        uploaderId: input.ctx.userId,
        visibility: input.visibility ?? "internal",
        scanStatus: "clean",
      },
    })
  } catch (error) {
    await supabase.storage.from(bucket).remove([objectPath])
    throw error
  }

  // Link to entity if provided
  if (input.entityType && input.entityId) {
    await db.fileLink.create({
      data: { fileId: file.id, entityType: input.entityType, entityId: input.entityId },
    })
  }

  return {
    id: file.id,
    bucket,
    objectPath,
    originalName: input.originalName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksum,
  }
}

/**
 * Download a file through the authenticated Storage client after the metadata
 * lookup has applied the workspace boundary.
 */
export async function readFile(
  ctx: WorkspaceContext,
  fileId: string
): Promise<{ body: Buffer; contentType: string; size: number; originalName: string } | null> {
  const file = await db.fileRecord.findFirst({
    where: { id: fileId, workspaceId: ctx.workspaceId },
  })
  if (!file) return null
  const supabase = await createServerClient()
  if (!supabase) return null
  const { data: blob, error } = await supabase.storage.from(file.bucket).download(file.objectPath)
  if (error || !blob) return null
  return {
    body: Buffer.from(await blob.arrayBuffer()),
    contentType: file.contentType ?? "application/octet-stream",
    size: Number(file.sizeBytes),
    originalName: file.originalName,
  }
}

/**
 * Generate a short-lived signed URL for downloading a file.
 * In Supabase mode this uses supabase.storage.from(bucket).createSignedUrl().
 * The route still performs the membership/permission check before returning
 * the short-lived signed URL.
 */
export async function createSignedDownloadUrl(
  ctx: WorkspaceContext,
  fileId: string,
  expiresInSec = 60
): Promise<string | null> {
  const file = await db.fileRecord.findFirst({
    where: { id: fileId, workspaceId: ctx.workspaceId },
  })
  if (!file) return null
  const supabase = await createServerClient()
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.objectPath, expiresInSec)
  if (error) return null
  return data.signedUrl
}

async function computeChecksum(buf: Buffer): Promise<string> {
  const { createHash } = await import("node:crypto")
  return createHash("sha256").update(buf).digest("hex")
}

/**
 * Delete a file (metadata + binary). Caller must check files.delete permission.
 */
export async function deleteFile(ctx: WorkspaceContext, fileId: string): Promise<void> {
  const file = await db.fileRecord.findFirst({
    where: { id: fileId, workspaceId: ctx.workspaceId },
  })
  if (!file) throw new Error("File not found")
  await db.fileLink.deleteMany({ where: { fileId } })
  await db.fileRecord.delete({ where: { id: fileId } })
  const supabase = await createServerClient()
  if (supabase) await supabase.storage.from(file.bucket).remove([file.objectPath])
}

/**
 * Validate a CSV file (used by import flow).
 * Returns { headers, rows, errors }.
 */
export async function parseCsv(
  buf: Buffer
): Promise<{ headers: string[]; rows: Record<string, string>[]; errors: string[] }> {
  const Papa = (await import("papaparse")).default
  const text = buf.toString("utf-8")
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
    errors: result.errors.map((e) => e.message),
  }
}
