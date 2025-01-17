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

  const handleMessageUpdate = async (payload: any) => {
    console.log('Thread message change:', payload);
    
    if (payload.eventType === 'DELETE') {
      setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      setReplyCount(prev => Math.max(0, prev - 1));
      return;
    }

    const message = payload.new;
    
    // For inserts and updates, we'll use the payload data and only fetch what's missing
    const { data: userData } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .eq('id', message.user_id)
      .single();

    if (!userData) return;

    const updatedMessage = { 
      ...message, 
      user: userData,
      reactions: [], // Initialize empty, will be updated via separate subscription
      attachments: message.attachments || []
    };

    if (payload.eventType === 'INSERT') {
      setMessages(prev => [...prev, updatedMessage]);
      setReplyCount(prev => prev + 1);
    } else {
      setMessages(prev => prev.map(m => m.id === updatedMessage.id ? {
        ...m,
        ...updatedMessage,
        reactions: m.reactions || [] // Preserve existing reactions
      } : m));
    }
  };

  useEffect(() => {
    if (profile?.id && threadId) {
      loadThreadMessages();

      // Set up realtime subscriptions with unique channel names
      const messageChannel = supabase
        .channel(`thread-messages-${threadId}-${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `reply_to=eq.${threadId}`,
          },
          handleMessageUpdate
        )
        .subscribe();

      // Subscribe to reaction changes separately
      const reactionChannel = supabase
        .channel(`thread-reactions-${threadId}-${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions_with_users',
            filter: `message_id=in.(select id from messages where reply_to=${threadId})`,
          },
          async (payload: any) => {
            const messageId = payload.new?.message_id || payload.old?.message_id;
            if (!messageId) return;
            
            // Fetch only reactions for the affected message
            const { data: reactions } = await supabase
              .from('message_reactions_with_users')
              .select('*')
              .eq('message_id', messageId);

            setMessages(prev => prev.map(msg => 
              msg.id === messageId ? { ...msg, reactions: reactions || [] } : msg
            ));
          }
        )
        .subscribe();

      return () => {
        messageChannel.unsubscribe();
        reactionChannel.unsubscribe();
      };
    }
  }, [profile?.id, threadId]);

  const loadThreadMessages = async () => {
    if (!threadId) return

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .rpc('get_thread_messages', {
          thread_id: threadId
        })

      if (error) throw error

      // Transform the data to match our Message type
      const typedMessages = data?.map((message: any) => ({
        id: message.id,
        channel_id: message.channel_id,
        user_id: message.user_id,
        content: message.content,
        reply_to: message.reply_to,
        reply_count: message.reply_count,
        created_at: message.created_at,
        updated_at: message.updated_at,
        user: {
          id: message.user_id,
          username: message.user_username,
          avatar_url: message.user_avatar_url
        }
      })) as Message[]

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

  const replyToMessage = async (content: string) => {
    if (!profile?.id || !threadId || !content.trim()) return null

    try {
      const { data: messageId, error } = await supabase
        .rpc('create_thread_reply', {
          thread_parent_id: threadId,
          message_content: content.trim()
        })

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