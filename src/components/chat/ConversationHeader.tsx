"use client"

import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChevronLeft, MoreVertical } from "lucide-react"

interface ConversationHeaderProps {
  name: string
  avatarUrl?: string | null
  isOnline?: boolean
}

export default function ConversationHeader({
  name,
  avatarUrl,
  isOnline,
}: ConversationHeaderProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={() => router.back()}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Avatar>
        <AvatarImage src={avatarUrl || ""} />
        <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {isOnline ? "online" : "offline"}
        </p>
      </div>
      <Button variant="ghost" size="icon">
        <MoreVertical className="h-5 w-5" />
      </Button>
    </div>
  )
}
