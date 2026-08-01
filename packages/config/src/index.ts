const DEFAULT_APPLICATION_ORIGIN = "http://localhost:3001"

function parseApplicationOrigin(value: string): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be an absolute http(s) URL")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use http or https")
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_APP_URL must contain only an application origin")
  }

  return url.origin
}

/**
 * Returns the independently deployed CRM origin. Local development defaults to
 * the app's port so the marketing site can be run without extra configuration.
 */
export function getApplicationOrigin(value = process.env.NEXT_PUBLIC_APP_URL): string {
  return parseApplicationOrigin(value?.trim() || DEFAULT_APPLICATION_ORIGIN)
}

function isSafeRelativePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false
  if (/[%\u0000-\u001f\u007f]/.test(value)) {
    try {
      value = decodeURIComponent(value)
    } catch {
      return false
    }
  }
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.includes(":") &&
    !/[\u0000-\u001f\u007f]/.test(value)
  )
}

/**
 * Accepts only a path on the current application. Absolute, protocol-relative,
 * scheme-bearing, malformed, and backslash-based targets are rejected.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = "/"): string {
  if (typeof target !== "string" || !isSafeRelativePath(target)) return fallback
  return target
}

/** Builds a link to a path owned by the authenticated application. */
export function applicationUrl(path = "/", origin?: string): string {
  if (!isSafeRelativePath(path)) {
    throw new Error("Application links must use a safe relative path")
  }
  return new URL(path, getApplicationOrigin(origin)).toString()
}
