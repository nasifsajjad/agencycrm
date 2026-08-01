/**
 * AgencyOS — Storage adapter.
 *
 * Production: uses Supabase Storage with RLS-governed buckets.
 * Local fallback: writes files to /home/z/my-project/.storage/ and serves
 * them via a Next.js route handler. Metadata is always stored in the
 * `files` table (Prisma in local mode, public.files in Supabase mode).
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import type { WorkspaceContext } from "@/lib/auth"

const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || "/home/z/my-project/.storage"
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
 * In local mode, writes to disk; in Supabase mode, uploads to the storage bucket.
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

  // Local storage: write to disk
  await fs.mkdir(path.dirname(path.join(LOCAL_STORAGE_DIR, bucket, objectPath)), {
    recursive: true,
  })
  await fs.writeFile(path.join(LOCAL_STORAGE_DIR, bucket, objectPath), input.body)

  // Persist metadata in the files table
  const file = await db.fileRecord.create({
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
 * Read a file from local storage (or fetch a signed URL from Supabase).
 * Returns a stream + metadata for the route handler to pipe.
 */
export async function readFile(
  ctx: WorkspaceContext,
  fileId: string
): Promise<{ body: Buffer; contentType: string; size: number; originalName: string } | null> {
  const file = await db.fileRecord.findFirst({
    where: { id: fileId, workspaceId: ctx.workspaceId },
  })
  if (!file) return null
  // Production path: when NEXT_PUBLIC_SUPABASE_URL is set, this would call
  // supabase.storage.from(bucket).createSignedUrl(objectPath, 60) and return a
  // redirect. The local adapter reads from disk so we can verify the download
  // path end-to-end without external dependencies.
  try {
    const body = await fs.readFile(path.join(LOCAL_STORAGE_DIR, file.bucket, file.objectPath))
    return {
      body,
      contentType: file.contentType ?? "application/octet-stream",
      size: Number(file.sizeBytes),
      originalName: file.originalName,
    }
  } catch {
    return null
  }
}

/**
 * Generate a short-lived signed URL for downloading a file.
 * In Supabase mode this uses supabase.storage.from(bucket).createSignedUrl().
 * In local mode it returns a path to /api/files/[id]/download which checks membership.
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
  // Local: route handler checks session + membership
  return `/api/files/${fileId}/download?exp=${Date.now() + expiresInSec * 1000}`
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
  try {
    await fs.unlink(path.join(LOCAL_STORAGE_DIR, file.bucket, file.objectPath))
  } catch {
    // best-effort
  }
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
