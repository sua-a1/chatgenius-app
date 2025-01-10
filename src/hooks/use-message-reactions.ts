'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from './use-toast'

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  username: string
  avatar_url: string | null
}

export interface ReactionGroup {
  emoji: string
  count: number
  users: {
    username: string
    avatar_url: string | null
  }[]
}

export function useMessageReactions(messageId: string, isDirect: boolean = false) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [reactions, setReactions] = useState<MessageReaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Group reactions by emoji
  const groupedReactions = reactions.reduce<Record<string, ReactionGroup>>((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: []
      }
    }
    acc[reaction.emoji].count++
    acc[reaction.emoji].users.push({
      username: reaction.username,
      avatar_url: reaction.avatar_url
    })
    return acc
  }, {})

  useEffect(() => {
    if (!messageId) return

    setIsLoading(true)
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
        .select('*')
        .eq(isDirect ? 'direct_message_id' : 'message_id', messageId)

      if (error) throw error

      setReactions(data || [])
    } catch (error) {
      console.error('Error loading reactions:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading reactions',
        description: 'Please try again later.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addReaction = async (emoji: string) => {
    if (!profile?.id) return

    try {
      const table = isDirect ? 'direct_message_reactions' : 'message_reactions'
      const messageField = isDirect ? 'direct_message_id' : 'message_id'

      const { error } = await supabase
        .from(table)
        .insert([{
          [messageField]: messageId,
          user_id: profile.id,
          emoji,
        }])

      if (error) throw error
    } catch (error) {
      console.error('Error adding reaction:', error)
      toast({
        variant: 'destructive',
        title: 'Error adding reaction',
        description: 'Please try again later.',
      })
    }
  }

  const removeReaction = async (emoji: string) => {
    if (!profile?.id) return

    try {
      const table = isDirect ? 'direct_message_reactions' : 'message_reactions'
      const messageField = isDirect ? 'direct_message_id' : 'message_id'

      const { error } = await supabase
        .from(table)
        .delete()
        .eq(messageField, messageId)
        .eq('user_id', profile.id)
        .eq('emoji', emoji)

      if (error) throw error
    } catch (error) {
      console.error('Error removing reaction:', error)
      toast({
        variant: 'destructive',
        title: 'Error removing reaction',
        description: 'Please try again later.',
      })
    }
  }

  const hasUserReacted = (emoji: string) => {
    return reactions.some(r => r.user_id === profile?.id && r.emoji === emoji)
  }

  return {
    reactions: Object.values(groupedReactions),
    isLoading,
    addReaction,
    removeReaction,
    hasUserReacted,
  }
} 