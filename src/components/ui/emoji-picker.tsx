"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SmilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"

const commonEmojis = ["👍", "❤️", "😂", "🎉", "🤔", "😢", "🔥", "👀"]

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <SmilePlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="grid grid-cols-4 gap-2 p-2">
          {commonEmojis.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => onEmojiSelect(emoji)}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
} 