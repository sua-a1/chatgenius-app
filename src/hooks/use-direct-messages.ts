'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from './use-toast'
import { useUserStatus } from '@/contexts/user-status-context'

interface DirectMessageReaction {
  id: string
  direct_message_id: string
  user_id: string
  emoji: string
  created_at: string
  username: string
  avatar_url: string | null
}

interface DirectMessageUser {
  id: string
  username: string
  avatar_url: string | null
}

interface DirectMessage {
  id: string
  content: string
  created_at: string
  sender_id: string
  receiver_id: string
  sender: DirectMessageUser
  receiver: DirectMessageUser
  reactions: DirectMessageReaction[]
  attachments?: Array<{
    url: string
    filename: string
  }>
}

interface DatabaseResponse {
  id: string
  message: string
  created_at: string
  sender_id: string
  receiver_id: string
  workspace_id: string
  attachments: Array<{
    url: string
    filename: string
  }> | null
  sender: {
    id: string
    username: string
    avatar_url: string | null
  }
  receiver: {
    id: string
    username: string
    avatar_url: string | null
  }
  direct_message_reactions_with_users: DirectMessageReaction[]
}

interface RecentChat {
  user_id: string
  username: string
  avatar_url: string | null
  last_message_at: string
}

export function useDirectMessages(workspaceId: string | undefined, selectedUserId: string | null) {
  const { profile, isInitialized } = useAuth()
  const { userStatuses } = useUserStatus()
  const { toast } = useToast()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [recentChats, setRecentChats] = useState<RecentChat[]>([])
  const [selectedUser, setSelectedUser] = useState<DirectMessageUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const debouncedLoadChats = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoad = useRef(true)
  const sentMessageIds = useRef<Set<string>>(new Set()) // Track messages we've sent
  const editedMessageIds = useRef<Set<string>>(new Set()) // Track messages we've edited

  // Clear tracking sets when switching chats
  useEffect(() => {
    if (selectedUserId) {
      sentMessageIds.current.clear()
      editedMessageIds.current.clear()
    }
  }, [selectedUserId])

  const updateChatsDebounced = () => {
    if (debouncedLoadChats.current) {
      clearTimeout(debouncedLoadChats.current)
    }
    debouncedLoadChats.current = setTimeout(() => {
      loadChats()
      debouncedLoadChats.current = null
    }, 500) // Reduced delay for better responsiveness
  }

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (debouncedLoadChats.current) {
        clearTimeout(debouncedLoadChats.current)
        debouncedLoadChats.current = null
      }
    }
  }, [])

  // Load recent chats
  useEffect(() => {
    if (!isInitialized) {
      console.log('DM Hook: Auth not initialized yet')
      return
    }

    if (!workspaceId || !profile?.id) {
      console.log('DM Hook: Missing workspaceId or profileId')
      setRecentChats([])
      setIsLoading(false)
      return
    }

    loadChats()

    // Set up realtime subscription for chats only
    const channel = supabase
      .channel(`direct_messages:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          // Skip updates for messages we sent (already handled)
          if (payload.eventType === 'INSERT' && sentMessageIds.current.has(payload.new.id)) {
            console.log('DM Hook: Skipping chat update for message we sent:', payload.new.id)
            return
          }
          updateChatsDebounced() // Use debounced update for chats
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [workspaceId, profile?.id, isInitialized])

  const loadChats = async () => {
    try {
      setIsLoading(true)
      console.log('DM Hook: Loading chats...')

      const { data, error } = await supabase.rpc('get_recent_chats', {
        workspace_id_param: workspaceId,
        user_id_param: profile!.id
      })

      if (error) {
        console.error('DM Hook: Error from get_recent_chats:', error)
        throw error
      }

      console.log('DM Hook: Raw chats data:', data)
      const chats = data || []
      setRecentChats(chats)
      console.log('DM Hook: Processed chats:', chats)
    } catch (error) {
      console.error('DM Hook: Error loading chats:', error)
      setRecentChats([])
      toast({
        variant: 'destructive',
        title: 'Error loading chats',
        description: 'Could not load recent chats. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load selected user separately
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null)
      return
    }
    loadSelectedUser()
  }, [selectedUserId])

  // Reset initial load when selected user changes
  useEffect(() => {
    if (selectedUserId) {
      isInitialLoad.current = true
      setMessages([]) // Clear messages when switching chats
      setIsLoading(true)
      loadMessages().finally(() => {
        setIsLoading(false)
        isInitialLoad.current = false
      })
    }
  }, [selectedUserId])

  const handleMessageUpdate = async (payload: any) => {
    // Skip if we're still in initial load
    if (isInitialLoad.current) {
      console.log('DM Hook: Skipping event during initial load');
      return;
    }

    // Skip if this is a message we sent or edited (already handled)
    if (payload.eventType === 'INSERT' && sentMessageIds.current.has(payload.new.id)) {
      console.log('DM Hook: Skipping event for message we sent:', payload.new.id);
      return;
    }
    if (payload.eventType === 'UPDATE' && editedMessageIds.current.has(payload.new.id)) {
      console.log('DM Hook: Skipping event for message we edited:', payload.new.id);
      editedMessageIds.current.delete(payload.new.id);
      return;
    }

    const messageData = payload.new;
    
    // For inserts and updates, fetch only the necessary additional data
    const [senderResponse, receiverResponse, reactionsResponse] = await Promise.all([
      supabase
        .from('users')
        .select('id, username, avatar_url')
        .eq('id', messageData.sender_id)
        .single(),
      supabase
        .from('users')
        .select('id, username, avatar_url')
        .eq('id', messageData.receiver_id)
        .single(),
      supabase
        .from('direct_message_reactions_with_users')
        .select('*')
        .eq('message_id', messageData.id)
    ]);

    if (senderResponse.error || receiverResponse.error) return;

    const updatedMessage: DirectMessage = {
      id: messageData.id,
      content: messageData.message,
      created_at: messageData.created_at,
      sender_id: messageData.sender_id,
      receiver_id: messageData.receiver_id,
      sender: senderResponse.data,
      receiver: receiverResponse.data,
      reactions: reactionsResponse.data || [],
      attachments: messageData.attachments || []
    };

    if (payload.eventType === 'INSERT') {
      setMessages(prev => {
        if (prev.some(msg => msg.id === updatedMessage.id)) {
          return prev;
        }
        return [...prev, updatedMessage];
      });
    } else {
      setMessages(prev => prev.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      ));
    }

    // Update chats in the background
    updateChatsDebounced();
  };

  // Update the realtime subscription effect
  useEffect(() => {
    if (!workspaceId || !selectedUserId || !profile?.id) {
      setMessages([]);
      return;
    }

    // Set up realtime subscription for messages
    const channel = supabase
      .channel(`direct_messages:${workspaceId}:${selectedUserId}:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `workspace_id=eq.${workspaceId} and ((sender_id=eq.${selectedUserId} and receiver_id=eq.${profile.id}) or (sender_id=eq.${profile.id} and receiver_id=eq.${selectedUserId}))`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            // Immediately remove the message from the UI
            setMessages(prev => {
              const filtered = prev.filter(msg => msg.id !== payload.old.id);
              console.log('DM Hook: Removed deleted message, remaining:', filtered.length);
              return filtered;
            });
            // Update chats in the background
            updateChatsDebounced();
          } else {
            // Handle both INSERT and UPDATE
            await handleMessageUpdate(payload);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('DM Hook: Cleaning up subscription');
      if (debouncedLoadChats.current) {
        clearTimeout(debouncedLoadChats.current);
        debouncedLoadChats.current = null;
      }
      channel.unsubscribe();
    };
  }, [workspaceId, selectedUserId, profile?.id]);

  const loadSelectedUser = async () => {
    if (!selectedUserId) return

    try {
      console.log('DM Hook: Loading selected user:', selectedUserId)
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, full_name, email, avatar_url, created_at')
        .eq('id', selectedUserId)
        .single()

      if (error) {
        console.error('DM Hook: Error loading selected user data:', error)
        throw error
      }

      console.log('DM Hook: Selected user data:', user)
      if (!user?.username) {
        console.error('DM Hook: Missing username in user data:', user)
        throw new Error('Invalid user data: missing username')
      }

      const selectedUser = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      }
      console.log('DM Hook: Processed selected user:', selectedUser)
      setSelectedUser(selectedUser)
    } catch (error) {
      console.error('DM Hook: Error loading selected user:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading user',
        description: 'Could not load user details. Please try again.',
      })
    }
  }

  const loadMessages = async () => {
    if (!workspaceId || !selectedUserId || !profile?.id) {
      console.log('DM Hook: Missing required IDs for loading messages')
      setMessages([])
      setIsLoading(false)
      return
    }

    try {
      console.log('DM Hook: Loading messages for user:', selectedUserId)
      const { data, error } = await supabase
        .from('direct_messages')
        .select(`
          id,
          message,
          created_at,
          sender_id,
          receiver_id,
          workspace_id,
          attachments,
          sender:users!direct_messages_sender_id_fkey(
            id,
            username,
            avatar_url
          ),
          receiver:users!direct_messages_receiver_id_fkey(
            id,
            username,
            avatar_url
          ),
          direct_message_reactions_with_users(*)
        `)
        .eq('workspace_id', workspaceId)
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true }) as { data: DatabaseResponse[] | null, error: any }

      if (error) {
        console.error('DM Hook: Database error loading messages:', error)
        throw error
      }

      if (!data) {
        console.log('DM Hook: No messages found')
        setMessages([])
        setIsLoading(false)
        return
      }

      console.log('DM Hook: Successfully loaded messages:', data.length)
      const newMessages = data.map((message) => ({
        id: message.id,
        content: message.message,
        created_at: message.created_at,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          avatar_url: message.sender.avatar_url
        },
        receiver: {
          id: message.receiver.id,
          username: message.receiver.username,
          avatar_url: message.receiver.avatar_url
        },
        reactions: message.direct_message_reactions_with_users || [],
        attachments: message.attachments || []
      }))

      setMessages(newMessages)
    } catch (error) {
      console.error('DM Hook: Error loading messages:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading messages',
        description: 'Could not load messages. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (content: string, attachments?: string[]) => {
    if (!profile?.id || !selectedUserId || !workspaceId) return false

    try {
      console.log('DM Hook: Sending message:', { content, receiverId: selectedUserId })
      const { data, error } = await supabase.rpc('send_direct_message', {
        p_content: content,
        p_receiver_id: selectedUserId,
        p_workspace_id: workspaceId,
        p_attachments: attachments ? attachments.join(',') : null
      })

      if (error) throw error

      // Optimistically add the message to the UI and track its ID
      if (data) {
        sentMessageIds.current.add(data)
        const newMessage: DirectMessage = {
          id: data,
          content: content,
          created_at: new Date().toISOString(),
          sender_id: profile.id,
          receiver_id: selectedUserId,
          sender: {
            id: profile.id,
            username: profile.username || 'Unknown',
            avatar_url: profile.avatar_url
          },
          receiver: selectedUser || {
            id: selectedUserId,
            username: 'Unknown',
            avatar_url: null
          },
          reactions: [],
          attachments: attachments ? attachments.map(url => ({
            url,
            filename: url.split('/').pop() || 'unknown'
          })) : []
        }
        setMessages(prev => [...prev, newMessage])
        
        // Update chats list immediately after sending
        loadChats()
      }

      console.log('DM Hook: Message sent successfully')
      return true
    } catch (error) {
      console.error('DM Hook: Error sending message:', error)
      toast({
        variant: 'destructive',
        title: 'Error sending message',
        description: 'Could not send message. Please try again.',
      })
      return false
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!profile?.id || !workspaceId) return false

    try {
      console.log('DM Hook: Deleting message:', messageId)
      const { error } = await supabase
        .from('direct_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', profile.id) // Ensure only sender can delete

      if (error) throw error

      // Optimistically remove the message from the UI
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
      console.log('DM Hook: Message deleted successfully')
      return true
    } catch (error) {
      console.error('DM Hook: Error deleting message:', error)
      toast({
        variant: 'destructive',
        title: 'Error deleting message',
        description: 'Could not delete message. Please try again.',
      })
      return false
    }
  }

  const editMessage = async (messageId: string, newContent: string) => {
    if (!profile?.id || !workspaceId) return false

    try {
      console.log('DM Hook: Editing message:', { messageId, newContent })
      
      // First verify the message belongs to the user
      const message = messages.find(msg => msg.id === messageId)
      if (!message || message.sender_id !== profile.id) {
        throw new Error('Cannot edit message: not the sender')
      }

      const { data, error } = await supabase
        .from('direct_messages')
        .update({ message: newContent })
        .eq('id', messageId)
        .eq('sender_id', profile.id) // Ensure only sender can edit
        .select()
        .single()

      if (error) throw error

      // Track this edit to prevent duplicate handling
      editedMessageIds.current.add(messageId)

      // Optimistically update the UI
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            content: newContent
          }
        }
        return msg
      }))

      console.log('DM Hook: Message edited successfully')
      return true
    } catch (error) {
      console.error('DM Hook: Error editing message:', error)
      toast({
        variant: 'destructive',
        title: 'Error editing message',
        description: 'Could not edit message. Please try again.',
      })
      return false
    }
  }

  const loadThreadMessages = useCallback(async (messageId: string) => {
    const { data: directReplies } = await supabase
      .from('messages')
      .select(`
        id,
        channel_id,
        user_id,
        content,
        reply_to,
        reply_count,
        created_at,
        updated_at,
        attachments,
        user:users(id, username, avatar_url)
      `)
      .eq('reply_to', messageId)
      .order('created_at', { ascending: true })

    // Get replies to replies
    const replyIds = directReplies?.map(m => m.id) || []
    const { data: nestedReplies } = await supabase
      .from('messages')
      .select(`
        id,
        channel_id,
        user_id,
        content,
        reply_to,
        reply_count,
        created_at,
        updated_at,
        attachments,
        user:users(id, username, avatar_url)
      `)
      .in('reply_to', replyIds)
      .order('created_at', { ascending: true })

    return [...(directReplies || []), ...(nestedReplies || [])]
  }, [])

  return {
    messages,
    recentChats,
    selectedUser,
    isLoading,
    sendMessage,
    deleteMessage,
    editMessage,
    refreshChats: loadChats,
  }
} 