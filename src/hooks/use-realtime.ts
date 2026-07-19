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

  /**
   * Store the latest callbacks in refs so the subscription effect closure
   * always calls the most recent version — avoids the stale-closure bug
   * that would occur if we re-subscribed on every callback change.
   */
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)

  useEffect(() => {
    onInsertRef.current = onInsert
  }, [onInsert])

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    onDeleteRef.current = onDelete
  }, [onDelete])

  /**
   * Keep a stable Supabase client reference so we don't create a new
   * singleton on every render.
   */
  const supabaseRef = useRef(getSupabaseClient())

  useEffect(() => {
    const supabase = supabaseRef.current

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
        onInsertRef.current?.(payload)
      })
      .on("postgres_changes", { ...channelConfig, event: "UPDATE" }, (payload) => {
        onUpdateRef.current?.(payload)
      })
      .on("postgres_changes", { ...channelConfig, event: "DELETE" }, (payload) => {
        onDeleteRef.current?.(payload)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter]) // Only re-subscribe if table/filter change, not callbacks

  return channelRef
}
