'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from './use-toast'

interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  username: string
  avatar_url: string | null
}

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string
  channel_id: string
  user: {
    id: string
    username: string
    avatar_url: string | null
  }
  reactions: MessageReaction[]
}

interface DatabaseResponse {
  id: string
  content: string
  created_at: string
  user_id: string
  channel_id: string
  user: {
    id: string
    username: string
    avatar_url: string | null
  }
  message_reactions_with_users: MessageReaction[]
}

export function useMessages(channelId: string | undefined) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!channelId) return

    setIsLoading(true)
    loadMessages()

    // Set up realtime subscription
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        () => {
          loadMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions_with_users',
          filter: `message_id=in.(select id from messages where channel_id=${channelId})`
        },
        () => {
          loadMessages()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [channelId])

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          user:users(id, username, avatar_url),
          message_reactions_with_users(*)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(
        (data as DatabaseResponse[]).map(message => ({
          ...message,
          user: message.user,
          reactions: message.message_reactions_with_users || []
        }))
      )
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading messages',
        description: 'Could not load messages. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (content: string) => {
    if (!profile) return false

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          content,
          channel_id: channelId,
          user_id: profile.id,
        }])

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        variant: 'destructive',
        title: 'Error sending message',
        description: 'Could not send message. Please try again.',
      })
      return false
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!profile) return false

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', profile.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting message:', error)
      toast({
        variant: 'destructive',
        title: 'Error deleting message',
        description: 'Could not delete message. Please try again.',
      })
      return false
    }
  }

  const updateMessage = async (messageId: string, content: string) => {
    if (!profile) return false

    try {
      const { error } = await supabase
        .from('messages')
        .update({ content })
        .eq('id', messageId)
        .eq('user_id', profile.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating message:', error)
      toast({
        variant: 'destructive',
        title: 'Error updating message',
        description: 'Could not update message. Please try again.',
      })
      return false
    }
  }

  return {
    messages,
    isLoading,
    sendMessage,
    deleteMessage,
    updateMessage,
  }
} 