import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserPlus } from 'lucide-react'
import { DirectMessageChat, UserStatus } from '@/types'

interface DirectMessageListProps {
  recentChats: DirectMessageChat[]
  isLoading: boolean
  isCollapsed: boolean
  userStatuses: Map<string, UserStatus>
  onSelectDM: (userId: string) => void
  onAddDM: () => void
}

export function DirectMessageList({ 
  recentChats, 
  isLoading, 
  isCollapsed, 
  userStatuses, 
  onSelectDM, 
  onAddDM 
}: DirectMessageListProps) {
  const [showAllDMs, setShowAllDMs] = useState(false)

  const visibleDMs = showAllDMs ? recentChats : recentChats.slice(0, 5)

  return (
    <div>
      <h2 className={`text-lg font-semibold px-2 mb-2 ${isCollapsed ? 'text-center' : ''}`}>
        {isCollapsed ? '@' : 'Direct Messages'}
      </h2>
      <div className="space-y-1">
        {isLoading && (
          <div className="text-sm text-muted-foreground px-2">Loading chats...</div>
        )}
        {!isLoading && recentChats.length === 0 && (
          <div className="text-sm text-muted-foreground px-2">No direct messages yet</div>
        )}
        {!isLoading && recentChats.length > 0 && (
          <>
            {visibleDMs.map((chat) => (
              <Button
                key={chat.user_id}
                variant="ghost"
                className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
                onClick={() => onSelectDM(chat.user_id)}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <Avatar 
                    className="h-6 w-6"
                    status={userStatuses.get(chat.user_id)}
                  >
                    <AvatarImage src={chat.avatar_url || undefined} />
                    <AvatarFallback>{chat.username ? chat.username[0].toUpperCase() : '?'}</AvatarFallback>
                  </Avatar>
                  {!isCollapsed && <span className="truncate">{chat.username}</span>}
                </div>
              </Button>
            ))}
            {!isCollapsed && recentChats.length > 5 && (
              <Button
                variant="ghost"
                className="w-full justify-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllDMs(!showAllDMs)}
              >
                {showAllDMs ? 'Show Less' : `Show ${recentChats.length - 5} More`}
              </Button>
            )}
          </>
        )}
        {!isCollapsed && (
          <Button
            variant="ghost"
            className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
            onClick={onAddDM}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            <span>New Message</span>
          </Button>
        )}
      </div>
    </div>
  )
} 