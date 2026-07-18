"use client"

import { useRef, useEffect } from "react"

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]

interface ReactionPickerProps {
  onReact: (emoji: string) => void
  onClose: () => void
  anchorRect?: DOMRect | null
}

export default function ReactionPicker({ onReact, onClose, anchorRect }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute z-50 flex gap-1 rounded-full border bg-popover px-2 py-1.5 shadow-lg animate-in zoom-in-95 fade-in"
      style={
        anchorRect
          ? {
              bottom: `calc(100dvh - ${anchorRect.top}px + 8px)`,
              left: `${anchorRect.left}px`,
              transform: "translateX(0)",
            }
          : { bottom: "100%", left: "0", marginBottom: "6px" }
      }
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={(e) => {
            e.stopPropagation()
            onReact(emoji)
            onClose()
          }}
          className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent text-lg transition-all active:scale-125 hover:scale-110"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
