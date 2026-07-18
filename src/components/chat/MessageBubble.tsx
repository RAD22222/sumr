"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Check, CheckCheck, Reply, MoreHorizontal } from "lucide-react"
import ReactionPicker from "./ReactionPicker"
import type { Message, ReplyTo } from "@/lib/types"

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  onReply?: (message: ReplyTo) => void
  currentUserId: string | null
}

export default function MessageBubble({
  message,
  isOwn,
  onReply,
  currentUserId,
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const content = message.decrypted_content || message.encrypted_content || ""
  const reactions = message.reactions || {}

  const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0)

  function handleReact(emoji: string) {
    // Will be handled by parent via store
    console.log("React with", emoji, "on message", message.id)
  }

  function getSenderName(): string {
    if (isOwn && message.sender_id !== currentUserId) {
      return message.sender?.display_name || message.sender?.email || "Unknown"
    }
    return message.sender?.display_name || message.sender?.email || ""
  }

  return (
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
      {/* Reply target indicator */}
      {message.replyTo && (
        <button
          onClick={() => {
            document.getElementById(`msg-${message.replyTo!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
          }}
          className={cn(
            "flex items-center gap-1.5 mb-0.5 max-w-[75%] rounded-lg px-3 py-1.5 border-l-2 border-primary/50 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors",
            isOwn ? "mr-2" : "ml-2",
          )}
        >
          <Reply className="h-3 w-3 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary truncate">
              {message.replyTo.senderName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {message.replyTo.content}
            </p>
          </div>
        </button>
      )}

      {/* Bubble */}
      <div
        ref={bubbleRef}
        id={`msg-${message.id}`}
        className="relative group"
      >
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed transition-all",
            "hover:shadow-sm",
            isOwn
              ? "bg-message-self text-foreground rounded-br-md"
              : "bg-message-other text-foreground rounded-bl-md border",
          )}
        >
          {/* Sender name (for others) */}
          {!isOwn && message.sender && (
            <p className="text-xs font-semibold text-primary mb-0.5">
              {message.sender.display_name || message.sender.email?.split("@")[0]}
            </p>
          )}

          {/* Message content */}
          <p className="whitespace-pre-wrap break-words">{content}</p>

          {/* Time + status */}
          <div className={cn("flex items-center gap-1 mt-0.5", isOwn ? "justify-end" : "justify-start")}>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
            {isOwn && message.status && (
              <span>
                {message.status === "read" ? (
                  <CheckCheck className="h-3 w-3 text-primary" />
                ) : (
                  <Check className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reactions display */}
        {reactionEntries.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-0.5 -mt-1.5 relative z-10",
              isOwn ? "justify-end mr-3" : "justify-start ml-3",
            )}
          >
            {reactionEntries.map(([emoji, users]) => (
              <span
                key={emoji}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm cursor-default",
                  users.includes(currentUserId || "") && "border-primary/40",
                )}
              >
                <span className="text-sm">{emoji}</span>
                {users.length > 1 && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {users.length}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div
          className={cn(
            "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
            isOwn ? "left-0 -translate-x-full pl-1" : "right-0 translate-x-full pr-1",
          )}
        >
          <div className="flex items-center gap-0.5 rounded-full border bg-background px-1 py-0.5 shadow-sm">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="flex items-center justify-center h-6 w-6 rounded-full hover:bg-accent text-sm transition-colors"
            >
              😊
            </button>
            {onReply && (
              <button
                onClick={() =>
                  onReply({
                    id: message.id,
                    content,
                    senderName: isOwn ? "You" : getSenderName() || "Unknown",
                  })
                }
                className="flex items-center justify-center h-6 w-6 rounded-full hover:bg-accent transition-colors"
              >
                <Reply className="h-3 w-3" />
              </button>
            )}
            <button className="flex items-center justify-center h-6 w-6 rounded-full hover:bg-accent transition-colors">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Reaction picker */}
        {showReactions && (
          <ReactionPicker
            onReact={handleReact}
            onClose={() => setShowReactions(false)}
            anchorRect={bubbleRef.current?.getBoundingClientRect()}
          />
        )}
      </div>
    </div>
  )
}
