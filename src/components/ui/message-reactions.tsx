import { Button } from "@/components/ui/button"
import { EmojiPicker } from "@/components/ui/emoji-picker"
import { cn } from "@/lib/utils"

interface MessageReactionsProps {
  reactions: { emoji: string; users: string[] }[];
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
  currentUserId: string;
}

export function MessageReactions({ 
  reactions, 
  onAddReaction, 
  onRemoveReaction, 
  currentUserId 
}: MessageReactionsProps) {
  return (
    <div className="flex items-center gap-1 mt-1">
      {reactions.map(({ emoji, users }) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 rounded-full px-2 text-xs",
            users.includes(currentUserId) && "bg-accent"
          )}
          onClick={() => {
            users.includes(currentUserId) 
              ? onRemoveReaction(emoji)
              : onAddReaction(emoji)
          }}
        >
          {emoji} {users.length}
        </Button>
      ))}
      <EmojiPicker onEmojiSelect={onAddReaction} />
    </div>
  )
} 