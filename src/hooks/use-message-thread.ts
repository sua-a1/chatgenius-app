import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Message } from '@/types'

export function useMessageThread(threadId: string | null) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [replyCount, setReplyCount] = useState(0)

  useEffect(() => {
    if (profile?.id && threadId) {
      loadThreadMessages()

      // Subscribe to new messages in this thread
      const channel = supabase
        .channel(`thread-${threadId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `reply_to=eq.${threadId}`,
          },
          async (payload) => {
            console.log('[DEBUG] Thread message change:', payload)
            if (payload.eventType === 'INSERT') {
              // Add new message to state
              const message = payload.new as Message
              console.log('[DEBUG] New thread message:', message)
              // Fetch user info for the new message
              const { data: messageData } = await supabase
                .from('messages')
                .select(`
                  *,
                  user:users!inner (
                    id,
                    username,
                    avatar_url
                  )
                `)
                .eq('id', message.id)
                .single()

              console.log('[DEBUG] Fetched thread message data:', messageData)

              if (messageData) {
                const formattedMessage = {
                  ...messageData,
                  user: messageData.user,
                  attachments: Array.isArray(messageData.attachments) ? messageData.attachments : []
                }
                console.log('[DEBUG] Formatted thread message:', formattedMessage)
                setMessages(prev => {
                  console.log('[DEBUG] Previous messages:', prev)
                  const newMessages = [...prev, formattedMessage]
                  console.log('[DEBUG] Updated messages:', newMessages)
                  return newMessages
                })
                setReplyCount(prev => prev + 1)
              }
            } else if (payload.eventType === 'DELETE') {
              // Remove message from state
              const messageId = payload.old.id
              console.log('[DEBUG] Deleting thread message:', messageId)
              setMessages(prev => prev.filter(m => m.id !== messageId))
              setReplyCount(prev => Math.max(0, prev - 1))
            } else if (payload.eventType === 'UPDATE') {
              console.log('[DEBUG] Updating thread message:', payload.new)
              // Fetch full message data for the update
              const { data: messageData } = await supabase
                .from('messages')
                .select(`
                  *,
                  user:users!inner (
                    id,
                    username,
                    avatar_url
                  )
                `)
                .eq('id', payload.new.id)
                .single()

              console.log('[DEBUG] Fetched updated thread message data:', messageData)

              if (messageData) {
                const formattedMessage = {
                  ...messageData,
                  user: messageData.user,
                  attachments: Array.isArray(messageData.attachments) ? messageData.attachments : []
                }
                console.log('[DEBUG] Formatted updated thread message:', formattedMessage)
                setMessages(prev => {
                  console.log('[DEBUG] Previous messages before update:', prev)
                  const newMessages = prev.map(m => 
                    m.id === formattedMessage.id ? formattedMessage : m
                  )
                  console.log('[DEBUG] Messages after update:', newMessages)
                  return newMessages
                })
              }
            }
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    }
  }, [profile?.id, threadId])

  const loadThreadMessages = async () => {
    if (!threadId) return

    try {
      setIsLoading(true)
      console.log('[DEBUG] Loading thread messages for thread:', threadId)
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          user:users!inner (
            id,
            username,
            avatar_url
          ),
          message_reactions_with_users(*)
        `)
        .eq('reply_to', threadId)
        .order('created_at', { ascending: true })

      if (error) throw error

      console.log('[DEBUG] Raw thread messages:', data)
      
      // Transform the data to match our Message type
      const typedMessages = data?.map((message: any) => {
        console.log('[DEBUG] Processing thread message:', message)
        const transformed = {
          id: message.id,
          channel_id: message.channel_id,
          user_id: message.user_id,
          content: message.content,
          reply_to: message.reply_to,
          reply_count: message.reply_count,
          attachments: Array.isArray(message.attachments) ? message.attachments : [],
          created_at: message.created_at,
          updated_at: message.updated_at,
          user: message.user
        }
        console.log('[DEBUG] Transformed thread message:', transformed)
        return transformed
      }) as Message[]
      
      console.log('[DEBUG] All transformed thread messages:', typedMessages)

      setMessages(typedMessages || [])
      setReplyCount(typedMessages ? typedMessages.length - 1 : 0) // Subtract 1 to exclude parent message
    } catch (error) {
      console.error('Error loading thread messages:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading thread',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const replyToMessage = async (content: string, attachments?: { url: string; filename: string }[]) => {
    if (!profile?.id || !threadId || !content.trim()) return null

    try {
      console.log('[DEBUG] replyToMessage called with:', { content, attachments })
      const attachmentsString = attachments 
        ? attachments.map(a => a.url).join(',')
        : null

      console.log('[DEBUG] Processed attachments:', {
        raw: attachments,
        processed: attachmentsString
      })

      const { data: messageId, error } = await supabase
        .rpc('create_thread_reply', {
          thread_parent_id: threadId,
          content: content.trim(),
          p_attachments: attachmentsString
        })

      console.log('[DEBUG] create_thread_reply response:', { messageId, error })

      if (error) throw error

      // The subscription will handle updating the UI
      return messageId
    } catch (error) {
      console.error('Error replying to message:', error)
      toast({
        variant: 'destructive',
        title: 'Error sending reply',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
      return null
    }
  }

  const editMessage = async (messageId: string, content: string) => {
    if (!profile?.id) return false

    try {
      // Optimistically update the message
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content } : msg
      ))

      const { error } = await supabase
        .from('messages')
        .update({ content })
        .eq('id', messageId)
        .eq('user_id', profile.id) // Only allow editing own messages

      if (error) {
        // If update fails, reload messages
        loadThreadMessages()
        throw error
      }

      return true
    } catch (error) {
      console.error('Error editing message:', error)
      toast({
        variant: 'destructive',
        title: 'Error editing message',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
      return false
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!profile?.id) return false

    try {
      // Optimistically remove the message
      setMessages(prev => prev.filter(msg => msg.id !== messageId))

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', profile.id) // Only allow deleting own messages

      if (error) {
        // If deletion fails, reload messages
        loadThreadMessages()
        throw error
      }

      return true
    } catch (error) {
      console.error('Error deleting message:', error)
      toast({
        variant: 'destructive',
        title: 'Error deleting message',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
      return false
    }
  }

  return {
    messages,
    isLoading,
    replyCount,
    replyToMessage,
    editMessage,
    deleteMessage,
    loadThreadMessages
  }
} 