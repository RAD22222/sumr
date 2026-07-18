"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import type { User } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react"
import { toast } from "sonner"
import ChatListSidebar from "@/components/chat/ChatListSidebar"

interface AppShellProps {
  children: React.ReactNode
  user: User
  profile: Profile | null
}

export default function AppShell({ children, user, profile }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = getSupabaseClient()

  const isChatActive = pathname.startsWith("/chats/")
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(!isChatActive)
    } else {
      setSidebarOpen(true)
    }
  }, [pathname, isMobile])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
    toast.success("Signed out")
  }

  const navItems = [
    { label: "Chats", href: "/chats", icon: MessageSquare },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && isChatActive && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar flex-shrink-0 transition-all duration-200",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-40 w-80",
                sidebarOpen ? "translate-x-0" : "-translate-x-full",
              )
            : "w-80",
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-sidebar">
          <h2 className="font-semibold text-lg text-sidebar-foreground">Sumr</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/invite")}
            >
              <Plus className="h-5 w-5" />
            </Button>
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex border-b bg-sidebar px-2 py-1 gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => router.push(item.href)}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            )
          })}
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-hidden">
          <ChatListSidebar />
        </div>

        {/* User footer */}
        <div className="flex items-center gap-3 border-t px-4 py-2 bg-sidebar">
          <Avatar size="sm">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback>
              {(profile?.display_name || user.email || "U").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {profile?.display_name || user.email?.split("@")[0]}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user.email}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 flex flex-col min-w-0",
          isMobile && isChatActive ? "block" : isMobile && !isChatActive ? "hidden" : "block",
        )}
      >
        {/* Mobile header when no chat active */}
        {isMobile && !isChatActive && (
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="font-semibold">Sumr</h2>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
