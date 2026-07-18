"use client"

import { X, Reply } from "lucide-react"
import type { ReplyTo } from "@/lib/types"

interface ReplyPreviewProps {
  replyTo: ReplyTo
  onCancel: () => void
}

export default function ReplyPreview({ replyTo, onCancel }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30 animate-in slide-in-from-bottom-2 fade-in">
      <div className="w-0.5 h-8 shrink-0 rounded-full bg-primary/60" />
      <Reply className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary truncate">{replyTo.senderName}</p>
        <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-full p-1 hover:bg-accent transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
