import { callDatabaseRpc, createDatabase } from "@agencyos/database"
import { createServerClient, createServiceClient } from "@/lib/supabase/server"

export const db = createDatabase(createServerClient)
export const serviceDb = createDatabase(() => createServiceClient())
export const rpc = <T = unknown>(functionName: string, args: Record<string, unknown>) =>
  callDatabaseRpc<T>(createServerClient, functionName, args)
export const serviceRpc = <T = unknown>(functionName: string, args: Record<string, unknown>) =>
  callDatabaseRpc<T>(() => createServiceClient(), functionName, args)
