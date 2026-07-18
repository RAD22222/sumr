"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Send, Paperclip } from "lucide-react"
import EmojiPickerPopover from "./EmojiPickerPopover"
import ReplyPreview from "./ReplyPreview"
import type { ReplyTo } from "@/lib/types"

interface MessageInputProps {
  onSend: (content: string) => void
  replyTo?: ReplyTo | null
  onCancelReply?: () => void
}

export default function MessageInput({ onSend, replyTo, onCancelReply }: MessageInputProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`
    }
  }, [input])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [replyTo])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim()) return
    onSend(input.trim())
    setInput("")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleEmojiSelect(emoji: string) {
    setInput((prev) => prev + emoji)
    textareaRef.current?.focus()
  }

  return (
    <div className="border-t bg-background">
      {/* Reply preview */}
      {replyTo && onCancelReply && (
        <ReplyPreview replyTo={replyTo} onCancel={onCancelReply} />
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3">
        <EmojiPickerPopover onEmojiSelect={handleEmojiSelect} />

        <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </Button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            rows={1}
            className="w-full resize-none rounded-xl border border-input bg-muted/50 px-4 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground min-h-[44px] max-h-32"
          />
        </div>

        <Button type="submit" size="icon" disabled={!input.trim()} className="shrink-0 rounded-full">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
