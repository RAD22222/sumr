"use client"

import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { useE2EE } from "@/hooks/use-e2ee"

function E2EEInitializer({ children }: { children: React.ReactNode }) {
  useE2EE()
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <E2EEInitializer>{children}</E2EEInitializer>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
