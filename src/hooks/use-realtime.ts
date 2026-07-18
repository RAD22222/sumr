"use client"

import { useEffect, useRef } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeOptions {
  table: string
  filter?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}

export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const channelConfig: any = {
      event: "*",
      schema: "public",
      table,
    }
    if (filter) {
      channelConfig.filter = filter
    }

    const channel = supabase
      .channel(`${table}-${filter || "all"}`)
      .on("postgres_changes", { ...channelConfig, event: "INSERT" }, (payload) => {
        onInsert?.(payload)
      })
      .on("postgres_changes", { ...channelConfig, event: "UPDATE" }, (payload) => {
        onUpdate?.(payload)
      })
      .on("postgres_changes", { ...channelConfig, event: "DELETE" }, (payload) => {
        onDelete?.(payload)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter])

  return channelRef
}
