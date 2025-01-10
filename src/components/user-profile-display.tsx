'use client'

import * as React from 'react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useUserStatus } from '@/contexts/user-status-context'
import type { UserProfile } from '@/contexts/auth-context'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface DisplayUser {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  email: string
  created_at: string
}

interface UserProfileDisplayProps {
  user: {
    id: string
    username: string
    full_name?: string | null
    avatar_url?: string | null
    email?: string
    created_at?: string
  }
  children: React.ReactNode
  onStartDM?: (userId: string) => void
  showDMButton?: boolean
}

export function UserProfileDisplay({ user, children, onStartDM, showDMButton = true }: UserProfileDisplayProps) {
  const { userStatuses } = useUserStatus()
  const { toast } = useToast()
  const userStatus = userStatuses.get(user.id)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [displayUser, setDisplayUser] = useState<DisplayUser>({
    id: user.id,
    username: user.username,
    full_name: user.full_name || null,
    avatar_url: user.avatar_url || null,
    email: user.email || '',
    created_at: user.created_at || new Date().toISOString()
  })

  // Fetch complete user information if not provided
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user.email || !user.created_at) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id, username, full_name, email, avatar_url, created_at')
            .eq('id', user.id)
            .single()

          if (error) throw error

          if (data) {
            setDisplayUser({
              id: data.id,
              username: data.username,
              full_name: data.full_name || null,
              avatar_url: data.avatar_url || null,
              email: data.email || '',
              created_at: data.created_at
            })
          }
        } catch (error) {
          console.error('Error fetching user details:', error)
          toast({
            variant: 'destructive',
            title: 'Error loading user details',
            description: 'Could not load complete user information.',
          })
        }
      }
    }

    fetchUserInfo()
  }, [user.id, user.email, user.created_at, toast])

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent<UserProfile>) => {
      if (event.detail.id === user.id) {
        console.log('Updating displayed user profile:', event.detail)
        setDisplayUser(prev => ({
          ...prev,
          username: event.detail.username,
          full_name: event.detail.full_name,
          avatar_url: event.detail.avatar_url,
        }))
      }
    }

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener)
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
    }
  }, [user.id])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDialogOpen(true);
  };

  // Update display user when prop changes
  React.useEffect(() => {
    setDisplayUser({
      id: user.id,
      username: user.username,
      full_name: user.full_name || null,
      avatar_url: user.avatar_url || null,
      email: user.email || '',
      created_at: user.created_at || new Date().toISOString()
    })
  }, [user])

  const Trigger = React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>((props, ref) => (
    <div
      {...props}
      ref={ref}
      onClick={handleClick}
      className="cursor-pointer"
    >
      {children}
    </div>
  ));
  Trigger.displayName = 'Trigger';

  return (
    <>
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Trigger />
        </HoverCardTrigger>
        <HoverCardContent 
          className="z-[100] w-60" 
          align="start"
          side="right"
          avoidCollisions={true}
          sideOffset={5}
        >
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10" status={userStatus}>
                <AvatarImage src={displayUser.avatar_url || undefined} />
                <AvatarFallback>
                  {displayUser.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{displayUser.username}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${
                    userStatus === 'online' ? 'bg-green-500' :
                    userStatus === 'away' ? 'bg-yellow-500' :
                    userStatus === 'busy' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`} />
                  <p className="text-xs text-muted-foreground">
                    {userStatus ? userStatus.charAt(0).toUpperCase() + userStatus.slice(1) : 'Offline'}
                  </p>
                </div>
              </div>
            </div>
            {showDMButton && onStartDM && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStartDM(displayUser.id);
                }}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20" status={userStatus}>
                <AvatarImage src={displayUser.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {displayUser.full_name?.[0] || displayUser.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">{displayUser.full_name || displayUser.username}</h2>
                {displayUser.full_name && (
                  <p className="text-sm text-muted-foreground">@{displayUser.username}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    userStatus === 'online' ? 'bg-green-500' :
                    userStatus === 'away' ? 'bg-yellow-500' :
                    userStatus === 'busy' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`} />
                  <p className="text-sm text-muted-foreground">
                    {userStatus ? userStatus.charAt(0).toUpperCase() + userStatus.slice(1) : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {displayUser.email && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Email</h4>
                  <p className="text-sm">{displayUser.email}</p>
                </div>
              )}

              {displayUser.created_at && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Member Since</h4>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(displayUser.created_at), { addSuffix: true })}
                  </p>
                </div>
              )}
            </div>

            {showDMButton && onStartDM && (
              <div className="flex justify-end">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStartDM(displayUser.id);
                    setIsDialogOpen(false);
                  }}
                  className="w-full sm:w-auto"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 