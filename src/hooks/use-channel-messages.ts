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
  attachments?: Array<{
    url: string
    filename: string
  }>
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
  attachments: Array<{
    url: string
    filename: string
  }> | null
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
      // First get the messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          updated_at,
          user_id,
          channel_id,
          reply_to,
          attachments,
          user:users!inner(id, username, avatar_url),
          message_reactions_with_users(*)
        `)
        .eq('channel_id', selectedChannelId)
        .is('reply_to', null)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      // Then get reply counts for each message
      const messageIds = messages.map(m => m.id)
      const { data: replyCounts, error: countsError } = await supabase.rpc(
        'get_message_reply_counts',
        { message_ids: messageIds }
      )

      if (countsError) throw countsError

      // Create a map of message ID to reply count
      const replyCountMap = new Map(
        (replyCounts || []).map((r: { message_id: string; count: number }) => [r.message_id, r.count])
      )

      const processedMessages: Message[] = messages.map(message => {
        const userData = Array.isArray(message.user) ? message.user[0] : message.user
        return {
          id: message.id,
          content: message.content,
          created_at: message.created_at,
          updated_at: message.updated_at,
          user_id: message.user_id,
          channel_id: message.channel_id,
          reply_to: message.reply_to,
          reply_count: replyCountMap.get(message.id) || 0,
          attachments: message.attachments || [],
          user: {
            id: userData.id,
            username: userData.username,
            avatar_url: userData.avatar_url
          },
          reactions: message.message_reactions_with_users || []
        } as Message
      })

      setMessages(processedMessages)
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

  const handleMessageUpdate = async (messageId: string) => {
    // Fetch the complete updated message data
    const { data: messageData, error } = await supabase
      .from('messages')
      .select(`
        *,
        user:users!inner(id, username, avatar_url),
        message_reactions_with_users(*)
      `)
      .eq('id', messageId)
      .single()

    if (!error && messageData) {
      // Get the latest reply count
      const { data: replyCount } = await supabase.rpc(
        'get_message_reply_count',
        { message_id: messageId }
      )

      const userData = Array.isArray(messageData.user) ? messageData.user[0] : messageData.user
      setMessages(prev => prev.map(msg => 
        msg.id === messageData.id 
          ? {
              ...msg,
              ...messageData,
              user: userData,
              reply_count: replyCount || 0,
              reactions: messageData.message_reactions_with_users || msg.reactions || [],
              attachments: messageData.attachments || msg.attachments || []
            }
          : msg
      ))
    }
  }

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
          filter: `channel_id=eq.${selectedChannelId} and reply_to=is.null`
        },
        async (payload) => {
          // Only handle top-level messages
          await handleMessageUpdate(payload.new.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannelId} and reply_to=is.null`
        },
        async (payload) => {
          // Only handle top-level messages
          await handleMessageUpdate(payload.new.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannelId} and reply_to=is.null`
        },
        async (payload) => {
          // Only handle top-level messages
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      console.log('[DEBUG] Cleaning up subscription for channel:', selectedChannelId)
      channel.unsubscribe()
    }
  }, [workspaceId, selectedChannelId, profile?.id, loadMessages, loadSelectedChannel])

  const sendMessage = async (content: string, attachmentsOrReplyTo?: string[] | string) => {
    if (!profile?.id || !selectedChannelId || !workspaceId) return false

    try {
      // If attachmentsOrReplyTo is an array, it's attachments. If it's a string, it's a replyTo ID
      const isAttachments = Array.isArray(attachmentsOrReplyTo)
      const attachments = isAttachments ? attachmentsOrReplyTo : undefined
      const replyTo = !isAttachments ? attachmentsOrReplyTo : undefined

      // Use RPC function for messages with attachments
      if (attachments && !replyTo) {
        const { data, error } = await supabase.rpc('send_message', {
          p_content: content,
          p_channel_id: selectedChannelId,
          p_attachments: attachments.join(',')
        })

        if (error) throw error
      } else if (replyTo) {
        // Use create_thread_reply for thread replies
        const { data, error } = await supabase.rpc('create_thread_reply', {
          thread_parent_id: replyTo,
          message_content: content,
          attachments: attachments ? JSON.stringify(attachments.map(url => ({ url, filename: url.split('/').pop() || 'file' }))) : null
        })

        if (error) throw error
      } else {
        // Regular message insert
        const { error } = await supabase
          .from('messages')
          .insert([{
            content,
            channel_id: selectedChannelId,
            user_id: profile.id,
            reply_to: null,
          }])

        if (error) throw error
      }

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
      // First, get all messages that are direct replies to this thread (depth 1)
      const { data: directReplies, error: directError } = await supabase
        .from('messages')
        .select(`
          *,
          user:users(id, username, avatar_url),
          message_reactions_with_users(*)
        `)
        .eq('channel_id', selectedChannelId)
        .eq('reply_to', parentMessageId)
        .order('created_at', { ascending: true })

      if (directError) throw directError

      // Get replies to direct replies (depth 2)
      const directReplyIds = directReplies.map(msg => msg.id)
      const { data: nestedReplies, error: nestedError } = await supabase
        .from('messages')
        .select(`
          *,
          user:users(id, username, avatar_url),
          message_reactions_with_users(*)
        `)
        .eq('channel_id', selectedChannelId)
        .in('reply_to', directReplyIds)
        .order('created_at', { ascending: true })

      if (nestedError) throw nestedError

      // Combine messages and add depth information
      const allMessages = [
        ...directReplies.map(msg => ({ ...msg, depth: 1 })),
        ...(nestedReplies || []).map(msg => ({ ...msg, depth: 2 }))
      ]

      // Format messages with proper structure
      return allMessages.map(message => ({
        ...message,
        user: Array.isArray(message.user) ? message.user[0] : message.user,
        reactions: message.message_reactions_with_users || [],
        attachments: message.attachments || [],
        // Only show reply count for depth 2 messages that have replies
        reply_count: message.depth === 2 ? message.reply_count : 0
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