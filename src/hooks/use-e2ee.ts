"use client"

import { useEffect, useState, useCallback } from "react"
import { e2ee } from "@/lib/crypto/encryption"

export function useE2EE() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlock = useCallback(async (password: string) => {
    try {
      await e2ee.initialize(password)
      sessionStorage.setItem("sumr_master_password", password)
      setIsReady(true)
      setError(null)
      return true
    } catch {
      setError("Failed to initialize encryption. Wrong password?")
      return false
    }
  }, [])

  const lock = useCallback(() => {
    e2ee.clear()
    sessionStorage.removeItem("sumr_master_password")
    setIsReady(false)
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem("sumr_master_password")
    if (saved) {
      unlock(saved)
    }
  }, [unlock])

  return { isReady, error, unlock, lock }
}
