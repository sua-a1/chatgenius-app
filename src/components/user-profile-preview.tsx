'use client'

import * as React from 'react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface UserProfilePreviewProps {
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

export function UserProfilePreview({ user, children, onStartDM, showDMButton = true }: UserProfilePreviewProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback>
              {user.full_name?.[0] || user.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 flex-1">
            <h4 className="text-sm font-semibold">{user.full_name || user.username}</h4>
            {user.full_name && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
            {user.created_at && (
              <p className="text-sm text-muted-foreground">
                Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
              </p>
            )}
          </div>
          {showDMButton && onStartDM && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => onStartDM(user.id)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message
            </Button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
} 