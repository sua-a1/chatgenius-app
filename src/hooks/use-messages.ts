'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from './use-toast'

export type Message = {
  id: string
  content: string
  channel_id: string
  user_id: string
  reply_to: string | null
  reply_count: number
  attachments: any[] | null
  created_at: string
  updated_at: string
}

export type MessageWithUser = Message & {
  user: {
    id: string
    username: string
    avatar_url: string | null
  }
}

export function useMessages(workspaceId: string | undefined) {
  const { profile, isInitialized } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<MessageWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isInitialized) {
      console.log('Messages: Auth not initialized yet')
      return
    }

    if (!workspaceId || !profile?.id) {
      console.log('Messages: No workspace ID or profile available')
      setMessages([])
      setIsLoading(false)
      return
    }

    console.log('Messages: Loading messages for workspace:', workspaceId)
    loadMessages()

    // Set up realtime subscriptions
    const messagesChannel = supabase
      .channel(`messages:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=in.(select id from channels where workspace_id=eq.${workspaceId})`,
        },
        async () => {
          await loadMessages()
        }
      )
      .subscribe()

    return () => {
      messagesChannel.unsubscribe()
    }
  }, [workspaceId, profile?.id, isInitialized])

  const loadMessages = async () => {
    try {
      setIsLoading(true)
      
      // Get all channels in the workspace
      const { data: channels, error: channelsError } = await supabase
        .from('channels')
        .select('id')
        .eq('workspace_id', workspaceId)

      if (channelsError) throw channelsError

      if (!channels.length) {
        setMessages([])
        return
      }

      const channelIds = channels.map(c => c.id)

      // Get all messages from these channels
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          user:users!messages_user_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .in('channel_id', channelIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      setMessages(data?.map(message => ({
        ...message,
        user: message.user || {
          id: message.user_id,
          username: 'Deleted User',
          avatar_url: null
        }
      })) || [])
    } catch (error: any) {
      console.error('Error loading messages:', error)
      toast({
        title: 'Error loading messages',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (content: string, channelId: string) => {
    if (!profile?.id) return false

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
    if (!profile?.id) return false

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
    if (!profile?.id) return false

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
    loadMessages,
    sendMessage,
    deleteMessage,
    updateMessage,
  } as const
}

export type UseMessagesReturn = {
  messages: MessageWithUser[]
  isLoading: boolean
  loadMessages: () => Promise<void>
  sendMessage: (content: string, channelId: string) => Promise<boolean>
  deleteMessage: (messageId: string) => Promise<boolean>
  updateMessage: (messageId: string, content: string) => Promise<boolean>
} 