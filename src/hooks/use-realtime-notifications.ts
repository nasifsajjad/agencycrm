"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"

/**
 * Subscribe to realtime notifications for the current user.
 * Falls back to polling when Supabase Realtime isn't configured.
 */
export function useRealtimeNotifications(userId: string | undefined, onEvent?: () => void) {
  const router = useRouter()
  const [count, setCount] = React.useState(0)
  const supabase = React.useMemo(() => createBrowserClient(), [])

  React.useEffect(() => {
    if (!userId) return

    // Always poll as a fallback (every 30s)
    const poll = setInterval(() => {
      fetch("/api/notifications/count")
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.count === "number") {
            setCount(data.count)
            if (data.count > 0) onEvent?.()
          }
        })
        .catch(() => {})
    }, 30_000)
    // Initial fetch
    setTimeout(() => {
      fetch("/api/notifications/count")
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.count === "number") {
            setCount(data.count)
            if (data.count > 0) onEvent?.()
          }
        })
        .catch(() => {})
    }, 100)

    // If Supabase Realtime is available, subscribe
    if (supabase) {
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            onEvent?.()
            router.refresh()
          }
        )
        .subscribe()
      return () => {
        clearInterval(poll)
        supabase.removeChannel(channel)
      }
    }

    return () => clearInterval(poll)
  }, [userId, supabase, onEvent, router])

  return count
}
