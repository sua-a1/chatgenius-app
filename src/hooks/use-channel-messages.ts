'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface MessageUser {
  id: string
  username: string
  avatar_url: string | null
}

interface Message {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_id: string
  channel_id: string
  reply_to: string | null
  reply_count: number
  user?: {
    id: string
    username: string | null
    avatar_url: string | null
  }
  reactions: MessageReaction[]
}

interface DatabaseResponse {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_id: string
  channel_id: string
  reply_to: string | null
  reply_count: number
  user: {
    id: string
    username: string | null
    avatar_url: string | null
  }
  message_reactions_with_users: MessageReaction[]
}

interface Channel {
  id: string
  name: string
  topic: string | null
  created_at: string
}

export function useChannelMessages(workspaceId: string | undefined, selectedChannelId: string | null) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSelectedChannel = useCallback(async () => {
    if (!selectedChannelId) return

    try {
      const { data: channel, error } = await supabase
        .from('channels')
        .select('id, name, topic, created_at')
        .eq('id', selectedChannelId)
        .single()

      if (error) throw error

      setSelectedChannel(channel)
    } catch (error) {
      console.error('Error loading selected channel:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading channel',
        description: 'Could not load channel details. Please try again.',
      })
    }
  }, [selectedChannelId, toast])

  const loadMessages = useCallback(async () => {
    if (!selectedChannelId) return

    try {
      // Load messages that are not replies (reply_to is null)
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          updated_at,
          user_id,
          channel_id,
          reply_to,
          reply_count,
          user:users!inner(id, username, avatar_url),
          message_reactions_with_users(*)
        `)
        .eq('channel_id', selectedChannelId)
        .is('reply_to', null)
        .order('created_at', { ascending: true })

      if (error) throw error

      const messages = data.map(message => {
        const userData = Array.isArray(message.user) ? message.user[0] : message.user
        return {
          id: message.id,
          content: message.content,
          created_at: message.created_at,
          updated_at: message.updated_at,
          user_id: message.user_id,
          channel_id: message.channel_id,
          reply_to: message.reply_to,
          reply_count: message.reply_count,
          user: {
            id: userData.id,
            username: userData.username,
            avatar_url: userData.avatar_url
          },
          reactions: message.message_reactions_with_users || []
        }
      })

      setMessages(messages)
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
  }, [selectedChannelId, toast])

  useEffect(() => {
    if (!workspaceId || !selectedChannelId || !profile?.id) {
      console.log('[DEBUG] Missing required data:', { workspaceId, selectedChannelId, userId: profile?.id })
      return
    }

    setIsLoading(true)
    loadMessages()
    loadSelectedChannel()

    // Set up realtime subscription with unique channel name
    console.log('[DEBUG] Setting up realtime subscription for channel:', selectedChannelId)
    
    const channel = supabase.channel(`messages:${selectedChannelId}:${profile.id}`)
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannelId}`
        },
        async (payload) => {
          console.log('[DEBUG] New message received:', payload)
          
          // Only add message to main channel if it's not a reply
          if (!payload.new.reply_to) {
            // Optimistically add the new message
            const newMessage: Message = {
              id: payload.new.id,
              content: payload.new.content,
              created_at: payload.new.created_at,
              updated_at: payload.new.updated_at,
              user_id: payload.new.user_id,
              channel_id: payload.new.channel_id,
              reply_to: payload.new.reply_to,
              reply_count: payload.new.reply_count,
              user: payload.new.user || {
                id: payload.new.user_id,
                username: 'Loading...',
                avatar_url: null
              },
              reactions: []
            }
            setMessages(prev => [...prev, newMessage])
            // Reload messages to get full user data
            loadMessages()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannelId}`
        },
        (payload) => {
          console.log('[DEBUG] Message updated:', payload)
          setMessages(prev => prev.map(msg => 
            msg.id === payload.new.id 
              ? { 
                  ...msg, 
                  content: payload.new.content,
                  updated_at: payload.new.updated_at,
                  reply_count: payload.new.reply_count
                }
              : msg
          ))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannelId}`
        },
        (payload) => {
          console.log('[DEBUG] Message deleted (realtime):', payload)
          // Remove the deleted message from the UI
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
        }
      )
      .subscribe((status) => {
        console.log(`[DEBUG] Subscription status for channel ${selectedChannelId}:`, status)
      })

    return () => {
      console.log('[DEBUG] Cleaning up subscription for channel:', selectedChannelId)
      supabase.removeChannel(channel)
    }
  }, [workspaceId, selectedChannelId, profile?.id, loadMessages, loadSelectedChannel])

  const sendMessage = async (content: string, replyTo?: string) => {
    if (!profile?.id || !selectedChannelId) return false

    try {
      console.log('[DEBUG] Sending message:', { content, channelId: selectedChannelId, replyTo })
      
      // Send as a normal message or thread reply
      const { error } = await supabase
        .from('messages')
        .insert([{
          content,
          channel_id: selectedChannelId,
          user_id: profile.id,
          reply_to: replyTo || null,
        }])

      if (error) throw error

      await loadMessages() // Force reload messages after sending
      return true
    } catch (error) {
      console.error('[DEBUG] Error sending message:', error)
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
      console.log('[DEBUG] Deleting message:', messageId)
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', profile.id)

      if (error) throw error
      
      // Optimistically remove the message from the UI
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
      console.log('[DEBUG] Message deleted successfully')
      return true
    } catch (error) {
      console.error('[DEBUG] Error deleting message:', error)
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
      console.log('[DEBUG] Updating message:', { messageId, content })
      const { error } = await supabase
        .from('messages')
        .update({ content })
        .eq('id', messageId)
        .eq('user_id', profile.id)

      if (error) throw error
      console.log('[DEBUG] Message updated successfully')
      return true
    } catch (error) {
      console.error('[DEBUG] Error updating message:', error)
      toast({
        variant: 'destructive',
        title: 'Error updating message',
        description: 'Could not update message. Please try again.',
      })
      return false
    }
  }

  const loadThreadMessages = async (parentMessageId: string) => {
    if (!selectedChannelId) return []

    try {
      // First, get all messages that are direct replies to this thread
      const { data: threadData, error: threadError } = await supabase
        .from('messages')
        .select(`
          *,
          user:users(id, username, avatar_url),
          message_reactions_with_users(*)
        `)
        .eq('channel_id', selectedChannelId)
        .eq('reply_to', parentMessageId)
        .order('created_at', { ascending: true })

      if (threadError) throw threadError

      // Get all replies to any message in the thread
      const threadMessageIds = threadData.map(msg => msg.id)
      const { data: nestedReplies, error: nestedError } = await supabase
        .from('messages')
        .select(`
          *,
          user:users(id, username, avatar_url),
          message_reactions_with_users(*)
        `)
        .eq('channel_id', selectedChannelId)
        .in('reply_to', threadMessageIds)
        .order('created_at', { ascending: true })

      if (nestedError) throw nestedError

      // Combine and deduplicate messages
      const allMessages = [...threadData, ...(nestedReplies || [])]
      const uniqueMessages = Array.from(
        new Map(allMessages.map(msg => [msg.id, msg])).values()
      )

      return uniqueMessages.map(message => ({
        ...message,
        user: message.user,
        reactions: message.message_reactions_with_users || []
      }))
    } catch (error) {
      console.error('Error loading thread messages:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading thread messages',
        description: 'Could not load thread messages. Please try again.',
      })
      return []
    }
  }

  return {
    messages,
    selectedChannel,
    isLoading,
    sendMessage,
    deleteMessage,
    updateMessage,
    loadThreadMessages,
  }
} 