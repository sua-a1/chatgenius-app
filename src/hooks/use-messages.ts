'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from './use-toast'

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
}

export function useMessages(channelId: string | undefined) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (channelId) {
      loadMessages()
      const cleanup = subscribeToMessages()
      return () => {
        cleanup()
      }
    }
  }, [channelId])

  const loadMessages = async () => {
    try {
      setIsLoading(true)
      const { data: rawData, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          channel_id,
          user:users (
            id,
            username,
            avatar_url
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const data = rawData as unknown as DatabaseResponse[]
      setMessages(data)
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading messages',
        description: 'Could not load channel messages. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMessageWithUser = async (messageId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        user_id,
        channel_id,
        user:users (
          id,
          username,
          avatar_url
        )
      `)
      .eq('id', messageId)
      .single()

    if (error) throw error
    return data as unknown as DatabaseResponse
  }

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          try {
            if (payload.eventType === 'INSERT') {
              const message = await fetchMessageWithUser(payload.new.id)
              setMessages(prev => [...prev, message])
            } else if (payload.eventType === 'DELETE') {
              const deletedMessage = payload.old as Message
              setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id))
            } else if (payload.eventType === 'UPDATE') {
              const message = await fetchMessageWithUser(payload.new.id)
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === message.id ? message : msg
                )
              )
            }
          } catch (error) {
            console.error('Error handling realtime update:', error)
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
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