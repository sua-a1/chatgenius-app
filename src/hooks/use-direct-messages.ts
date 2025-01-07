'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from './use-toast'
import { DirectMessage as DatabaseDirectMessage } from '@/types'
import { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'

interface DirectMessageWithUser extends Omit<DatabaseDirectMessage, 'message'> {
  content: string
  sender: {
    id: string
    username: string
    avatar_url: string | null
  }
  recipient: {
    id: string
    username: string
    avatar_url: string | null
  }
}

interface DatabaseUser {
  id: string
  username: string
  avatar_url: string | null
}

interface RecentChat {
  user_id: string
  username: string
  avatar_url: string | null
  last_message_at: string
}

interface RealtimeDirectMessage {
  id: string
  message: string
  created_at: string
  sender_id: string
  receiver_id: string
  workspace_id: string
}

type DirectMessageChanges = RealtimePostgresChangesPayload<{
  [key: string]: any
  old: RealtimeDirectMessage | null
  new: RealtimeDirectMessage | null
}>

interface DatabaseMember {
  user_id: string
  users: {
    id: string
    username: string
    avatar_url: string | null
  }
}

interface DatabaseResponse {
  id: string
  message: string
  created_at: string
  sender_id: string
  receiver_id: string
  workspace_id: string
  sender: {
    id: string
    username: string
    avatar_url: string | null
  }
  recipient: {
    id: string
    username: string
    avatar_url: string | null
  }
}

export function useDirectMessages(
  workspaceId: string | undefined,
  selectedUserId: string | null
) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<DirectMessageWithUser[]>([])
  const [recentChats, setRecentChats] = useState<RecentChat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load recent chats when workspace changes
  useEffect(() => {
    if (workspaceId && profile?.id) {
      loadRecentChats()
      // Subscribe to all direct messages for this user in this workspace
      const cleanup = subscribeToDirectMessages()
      return () => {
        cleanup()
      }
    }
  }, [workspaceId, profile?.id])

  // Load messages when selected user changes
  useEffect(() => {
    if (selectedUserId && profile?.id) {
      loadMessages()
    } else {
      setMessages([])
    }
  }, [selectedUserId, profile?.id])

  const subscribeToDirectMessages = () => {
    if (!profile?.id || !workspaceId) return () => {}

    console.log('Subscribing to direct messages...', { workspaceId, userId: profile.id })

    const channelId = `direct_messages_${workspaceId}_${profile.id}`
    const subscription = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload: DirectMessageChanges) => {
          console.log('Received real-time update:', {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            selectedUserId
          })

          try {
            const newMessage = payload.new as RealtimeDirectMessage | null
            const oldMessage = payload.old as RealtimeDirectMessage | null

            // Always reload recent chats for any message event involving the current user
            if ((payload.eventType === 'INSERT' || payload.eventType === 'DELETE') &&
                ((newMessage?.sender_id === profile.id || newMessage?.receiver_id === profile.id) ||
                 (oldMessage?.sender_id === profile.id || oldMessage?.receiver_id === profile.id))) {
              console.log('Reloading recent chats due to message event involving current user')
              await loadRecentChats()
            }

            // If we don't have a selected user, we're done after reloading chats
            if (!selectedUserId) {
              console.log('No selected user, message updates will be loaded when a chat is selected')
              return
            }

            // Check if this message is relevant for the current chat
            const isRelevantMessage = newMessage ? (
              (newMessage.sender_id === profile.id && newMessage.receiver_id === selectedUserId) ||
              (newMessage.sender_id === selectedUserId && newMessage.receiver_id === profile.id)
            ) : oldMessage ? (
              (oldMessage.sender_id === profile.id && oldMessage.receiver_id === selectedUserId) ||
              (oldMessage.sender_id === selectedUserId && oldMessage.receiver_id === profile.id)
            ) : false

            console.log('Message relevance:', {
              isRelevantMessage,
              selectedUserId,
              profileId: profile.id,
              newMessage: newMessage ? {
                sender: newMessage.sender_id,
                receiver: newMessage.receiver_id
              } : null
            })

            if (!isRelevantMessage) {
              console.log('Message not relevant for current chat')
              return
            }

            if (payload.eventType === 'DELETE' && oldMessage) {
              console.log('Deleting message from state:', oldMessage.id)
              setMessages(prev => {
                const updated = prev.filter(msg => msg.id !== oldMessage.id)
                console.log('Updated messages after delete:', updated)
                return updated
              })
            } else if (payload.eventType === 'INSERT' && newMessage) {
              console.log('Fetching full message data for new message:', newMessage.id)
              const { data: rawData, error } = await supabase
                .from('direct_messages')
                .select(`
                  id,
                  message,
                  created_at,
                  sender_id,
                  receiver_id,
                  workspace_id,
                  sender:users!sender_id (
                    id,
                    username,
                    avatar_url
                  ),
                  recipient:users!receiver_id (
                    id,
                    username,
                    avatar_url
                  )
                `)
                .eq('id', newMessage.id)
                .single()

              if (error) {
                console.error('Error fetching message data:', error)
                throw error
              }

              console.log('Received full message data:', rawData)

              const data = rawData as unknown as DatabaseResponse
              const message: DirectMessageWithUser = {
                id: data.id,
                content: data.message,
                created_at: data.created_at,
                sender_id: data.sender_id,
                receiver_id: data.receiver_id,
                workspace_id: data.workspace_id,
                sender: {
                  id: data.sender.id,
                  username: data.sender.username,
                  avatar_url: data.sender.avatar_url
                },
                recipient: {
                  id: data.recipient.id,
                  username: data.recipient.username,
                  avatar_url: data.recipient.avatar_url
                }
              }

              console.log('Adding new message to state:', message)
              setMessages(prev => {
                const updated = [...prev, message]
                console.log('Updated messages after insert:', updated)
                return updated
              })
            }
          } catch (error) {
            console.error('Error handling realtime update:', error)
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Unsubscribing from direct messages...', { channelId })
      subscription.unsubscribe()
    }
  }

  const loadRecentChats = async () => {
    try {
      // First, get all workspace members
      const { data: members, error: membersError } = await supabase
        .from('workspace_memberships')
        .select(`
          user_id,
          users (
            id,
            username,
            avatar_url
          )
        `)
        .eq('workspace_id', workspaceId)
        .neq('user_id', profile!.id)

      if (membersError) throw membersError

      // Then, get recent messages for each member
      const { data: recentMessages, error: messagesError } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${profile!.id},receiver_id.eq.${profile!.id}`)
        .order('created_at', { ascending: false })

      if (messagesError) throw messagesError

      // Create a map of user_id to last message timestamp
      const lastMessageMap = new Map<string, string>()
      recentMessages.forEach((msg) => {
        const otherId = msg.sender_id === profile!.id ? msg.receiver_id : msg.sender_id
        if (!lastMessageMap.has(otherId)) {
          lastMessageMap.set(otherId, msg.created_at)
        }
      })

      // Combine member info with last message timestamps
      const chats = ((members || []) as unknown as DatabaseMember[]).map((member) => ({
        user_id: member.user_id,
        username: member.users.username,
        avatar_url: member.users.avatar_url,
        last_message_at: lastMessageMap.get(member.user_id) || new Date(0).toISOString()
      }))

      // Sort by last message time (most recent first) and take first 5
      const sortedChats = chats
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
        .slice(0, 5)

      setRecentChats(sortedChats)
    } catch (error) {
      console.error('Error loading recent chats:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading chats',
        description: 'Could not load recent chats. Please try again.',
      })
    }
  }

  const loadMessages = async () => {
    if (!selectedUserId) return

    try {
      setIsLoading(true)
      const { data: rawData, error } = await supabase
        .from('direct_messages')
        .select(`
          id,
          message,
          created_at,
          sender_id,
          receiver_id,
          workspace_id,
          sender:users!sender_id (
            id,
            username,
            avatar_url
          ),
          recipient:users!receiver_id (
            id,
            username,
            avatar_url
          )
        `)
        .or(`and(sender_id.eq.${profile!.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${profile!.id})`)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Transform the data to match our interface
      const messages: DirectMessageWithUser[] = ((rawData || []) as unknown as DatabaseResponse[]).map(msg => ({
        id: msg.id,
        content: msg.message,
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        workspace_id: msg.workspace_id,
        sender: {
          id: msg.sender.id,
          username: msg.sender.username,
          avatar_url: msg.sender.avatar_url
        },
        recipient: {
          id: msg.recipient.id,
          username: msg.recipient.username,
          avatar_url: msg.recipient.avatar_url
        }
      }))

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
  }

  const sendMessage = async (content: string) => {
    if (!profile || !selectedUserId || !workspaceId) return false

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert([{
          message: content,
          workspace_id: workspaceId,
          sender_id: profile.id,
          receiver_id: selectedUserId,
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
        .from('direct_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', profile.id)

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

  return {
    messages,
    recentChats,
    isLoading,
    sendMessage,
    deleteMessage,
  }
} 