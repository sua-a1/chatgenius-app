'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { Smile } from 'lucide-react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface MessageReactionsProps {
  messageId: string
  isDirect?: boolean
}

interface Reaction {
  id: string
  emoji: string
  username: string
}

interface GroupedReaction {
  emoji: string
  count: number
  users: string[]
}

export function MessageReactions({ messageId, isDirect = false }: MessageReactionsProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  useEffect(() => {
    if (!messageId) return

    loadReactions()

    // Set up realtime subscription
    const channel = supabase
      .channel(`reactions:${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: isDirect ? 'direct_message_reactions_with_users' : 'message_reactions_with_users',
          filter: isDirect 
            ? `direct_message_id=eq.${messageId}`
            : `message_id=eq.${messageId}`
        },
        () => {
          loadReactions()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [messageId, isDirect])

  const loadReactions = async () => {
    try {
      const { data, error } = await supabase
        .from(isDirect ? 'direct_message_reactions_with_users' : 'message_reactions_with_users')
        .select('id, emoji, username')
        .eq(isDirect ? 'direct_message_id' : 'message_id', messageId)

      if (error) throw error

      setReactions(data)
    } catch (error) {
      console.error('Error loading reactions:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading reactions',
        description: 'Could not load reactions. Please try again.',
      })
    }
  }

  const addReaction = async (emoji: string) => {
    if (!profile?.id) return

    try {
      const { error } = await supabase
        .from(isDirect ? 'direct_message_reactions' : 'message_reactions')
        .insert([{
          [isDirect ? 'direct_message_id' : 'message_id']: messageId,
          user_id: profile.id,
          emoji,
        }])

      if (error) throw error
      loadReactions()
    } catch (error) {
      console.error('Error adding reaction:', error)
      toast({
        variant: 'destructive',
        title: 'Error adding reaction',
        description: 'Could not add reaction. Please try again.',
      })
    }
  }

  const removeReaction = async (emoji: string) => {
    if (!profile?.id) return

    try {
      const { error } = await supabase
        .from(isDirect ? 'direct_message_reactions' : 'message_reactions')
        .delete()
        .eq(isDirect ? 'direct_message_id' : 'message_id', messageId)
        .eq('user_id', profile.id)
        .eq('emoji', emoji)

      if (error) throw error
      loadReactions()
    } catch (error) {
      console.error('Error removing reaction:', error)
      toast({
        variant: 'destructive',
        title: 'Error removing reaction',
        description: 'Could not remove reaction. Please try again.',
      })
    }
  }

  const groupedReactions = reactions.reduce<GroupedReaction[]>((acc, reaction) => {
    const existing = acc.find(r => r.emoji === reaction.emoji)
    if (existing) {
      existing.count++
      existing.users.push(reaction.username)
    } else {
      acc.push({
        emoji: reaction.emoji,
        count: 1,
        users: [reaction.username]
      })
    }
    return acc
  }, [])

  const hasReacted = (emoji: string) => {
    return reactions.some(r => r.emoji === emoji && r.username === profile?.username)
  }

  const handleReactionClick = (emoji: string) => {
    if (hasReacted(emoji)) {
      removeReaction(emoji)
    } else {
      addReaction(emoji)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {groupedReactions.map(reaction => (
        <TooltipProvider key={reaction.emoji}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={hasReacted(reaction.emoji) ? 'secondary' : 'outline'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => handleReactionClick(reaction.emoji)}
              >
                <span className="mr-1">{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{reaction.users.join(', ')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}

      <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Picker
            data={data}
            onEmojiSelect={(emoji: { native: string }) => {
              addReaction(emoji.native)
              setIsPickerOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
} 