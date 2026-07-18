"use client"

import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Check, CheckCheck } from "lucide-react"

interface MessageBubbleProps {
  content: string
  isOwn: boolean
  timestamp: string
  status?: "sending" | "sent" | "delivered" | "read"
  senderName?: string
  showSenderName?: boolean
}

export default function MessageBubble({
  content,
  isOwn,
  timestamp,
  status,
  senderName,
  showSenderName,
}: MessageBubbleProps) {
  return (
    <div
      className={cn("flex", isOwn ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
          isOwn
            ? "bg-message-self text-foreground rounded-br-md"
            : "bg-message-other text-foreground rounded-bl-md border",
        )}
      >
        {showSenderName && senderName && (
          <p className="text-xs font-semibold text-primary mb-0.5">
            {senderName}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{content}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-0.5",
            isOwn ? "justify-end" : "justify-start",
          )}
        >
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(timestamp), "HH:mm")}
          </span>
          {isOwn && status && (
            <span>
              {status === "read" ? (
                <CheckCheck className="h-3 w-3 text-primary" />
              ) : (
                <Check className="h-3 w-3 text-muted-foreground" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
