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
import type { UserStatus } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageSquare, Settings } from 'lucide-react'
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
  onClick?: (e: React.MouseEvent) => void
  onOpenProfileSettings?: () => void
}

// Memoized hover content component
const UserHoverPreview = React.memo(({ 
  user, 
  userStatus, 
  onStartDM, 
  showDMButton 
}: { 
  user: DisplayUser, 
  userStatus?: UserStatus,
  onStartDM?: (userId: string) => void,
  showDMButton?: boolean
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Avatar className="h-10 w-10" status={userStatus}>
        <AvatarImage src={user.avatar_url || undefined} />
        <AvatarFallback>
          {user.username ? user.username[0].toUpperCase() : '?'}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">{user.username || 'Unknown User'}</p>
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
        className="h-8"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onStartDM(user.id)
        }}
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
    )}
  </div>
))
UserHoverPreview.displayName = 'UserHoverPreview'

export function UserProfileDisplay({ user, children, onStartDM, showDMButton = true, onClick, onOpenProfileSettings }: UserProfileDisplayProps) {
  const { userStatuses } = useUserStatus()
  const { toast } = useToast()
  const userStatus = userStatuses.get(user.id)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [displayUser, setDisplayUser] = useState<DisplayUser>({
    id: user.id,
    username: user.username,
    full_name: user.full_name || null,
    avatar_url: user.avatar_url || null,
    email: user.email || '',
    created_at: user.created_at || new Date().toISOString()
  })

  // Always fetch complete user information
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user.id) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, full_name, email, avatar_url, created_at')
          .eq('id', user.id)
          .single()

        if (error) {
          if (error.code === '22P02') {
            setIsLoading(false)
            return
          }
          throw error
        }

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
        if ((error as any)?.code !== '22P02') {
          toast({
            variant: 'destructive',
            title: 'Error loading user details',
            description: 'Could not load complete user information.',
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserInfo()
  }, [user.id, toast])

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

  return (
    <>
      <div 
        onClick={(e) => {
          if (onClick) {
            onClick(e)
          } else {
            setIsDialogOpen(true)
          }
        }}
        className="relative group"
      >
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="cursor-pointer">
              {children}
            </div>
          </HoverCardTrigger>
          <HoverCardContent 
            className="z-[100] w-60" 
            align="start"
            side="right"
            avoidCollisions={true}
            sideOffset={5}
          >
            <UserHoverPreview 
              user={displayUser}
              userStatus={userStatus}
              onStartDM={onStartDM}
              showDMButton={showDMButton}
            />
          </HoverCardContent>
        </HoverCard>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading user information...
            </div>
          ) : (
            <div className="grid gap-6 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20" status={userStatus}>
                  <AvatarImage src={displayUser.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {displayUser.full_name?.[0] || displayUser.username?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold">{displayUser.full_name || displayUser.username || 'Unknown User'}</h2>
                  {displayUser.full_name && displayUser.username && (
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

              <div className="flex justify-end gap-2">
                {showDMButton && onStartDM && (
                  <Button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onStartDM(displayUser.id)
                      setIsDialogOpen(false)
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                )}
                {onOpenProfileSettings && (
                  <Button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onOpenProfileSettings()
                      setIsDialogOpen(false)
                    }}
                    variant="secondary"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
} 