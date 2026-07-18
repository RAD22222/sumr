"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SmilePlus } from "lucide-react"

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊",
      "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗",
      "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭",
      "😎", "🤓", "🧐", "😏", "😒", "😞", "😔", "😟",
      "😕", "🙃", "😣", "😖", "😩", "😤", "😠", "😡",
      "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹",
    ],
  },
  {
    name: "Gestures",
    emojis: [
      "👋", "🤚", "✋", "🖖", "👌", "🤌", "🤏", "✌️",
      "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏",
    ],
  },
  {
    name: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💕", "💞", "💓", "💗", "💖", "💘", "💝",
      "💟", "❣️", "♥️", "💌", "💋", "👄", "🫦", "💅",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🎀", "🪄", "✨", "⭐",
      "🌟", "💫", "🔥", "💯", "✅", "❌", "❓", "❗",
      "➕", "➖", "✔️", "🔞", "♻️", "📌", "📍", "🫂",
    ],
  },
]

interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void
}

export default function EmojiPickerPopover({ onEmojiSelect }: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function handleSelect(emoji: string) {
    onEmojiSelect(emoji)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full"
        onClick={() => setOpen(!open)}
      >
        <SmilePlus className="h-5 w-5 text-muted-foreground" />
      </Button>

      {open && (
        <div className="absolute bottom-12 left-0 z-50 w-72 sm:w-80 rounded-xl border bg-popover shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          {/* Category tabs */}
          <div className="flex gap-1 border-b px-2 pt-2 pb-1 overflow-x-auto">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.name}
                onClick={() => setCategory(i)}
                className={`shrink-0 text-xs px-2 py-1 rounded-md transition-colors ${
                  i === category
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
            {EMOJI_CATEGORIES[category].emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSelect(emoji)}
                className="flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent text-lg transition-colors active:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
