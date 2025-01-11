'use client'

import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserProfileDisplay } from '@/components/user-profile-display'
import type { UserStatus } from '@/components/ui/avatar'

interface UserAvatarProps {
  user: {
    id: string
    username: string
    full_name?: string | null
    avatar_url?: string | null
    email?: string
    created_at?: string
  }
  size?: 'sm' | 'md' | 'lg'
  status?: UserStatus
  showDMButton?: boolean
  onStartDM?: (userId: string) => void
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

export function UserAvatar({ 
  user, 
  size = 'md', 
  status,
  showDMButton = true,
  onStartDM,
  onClick,
  className 
}: UserAvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }

  return (
    <UserProfileDisplay
      user={user}
      showDMButton={showDMButton}
      onStartDM={onStartDM}
      onClick={onClick}
    >
      <div className="cursor-pointer">
        <Avatar 
          className={`${sizeClasses[size]} ${className || ''}`}
          status={status}
        >
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback>
            {user.full_name?.[0] || user.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
    </UserProfileDisplay>
  )
}

interface UserNameProps {
  user: {
    id: string
    username: string
    full_name?: string | null
    avatar_url?: string | null
    email?: string
    created_at?: string
  }
  showDMButton?: boolean
  onStartDM?: (userId: string) => void
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

export function UserName({
  user,
  showDMButton = true,
  onStartDM,
  onClick,
  className
}: UserNameProps) {
  return (
    <UserProfileDisplay
      user={user}
      showDMButton={showDMButton}
      onStartDM={onStartDM}
      onClick={onClick}
    >
      <span className={`cursor-pointer ${className || ''}`}>
        {user.full_name || user.username}
      </span>
    </UserProfileDisplay>
  )
} 