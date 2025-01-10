import { useAuth } from '@/contexts/auth-context'
import { useUserStatus } from '@/contexts/user-status-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User, Circle } from 'lucide-react'
import { UserProfileDisplay } from '@/components/user-profile-display'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function UserMenu() {
  const { profile } = useAuth()
  const { userStatuses, updateMyStatus } = useUserStatus()
  const currentStatus = userStatuses.get(profile?.id || '') || 'offline'
  const supabase = createClientComponentClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (!profile) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UserProfileDisplay
          user={{
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            email: profile.email,
            created_at: profile.created_at
          }}
          showDMButton={false}
        >
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8" status={currentStatus}>
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
              <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </UserProfileDisplay>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {profile.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Circle className={`mr-2 h-4 w-4 ${
                currentStatus === 'online' ? 'text-green-500' :
                currentStatus === 'away' ? 'text-yellow-500' :
                currentStatus === 'busy' ? 'text-red-500' :
                'text-gray-500'
              }`} />
              <span className="capitalize">{currentStatus}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={currentStatus} onValueChange={value => updateMyStatus(value as any)}>
                  <DropdownMenuRadioItem value="online">
                    <Circle className="mr-2 h-4 w-4 text-green-500" />
                    Online
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="away">
                    <Circle className="mr-2 h-4 w-4 text-yellow-500" />
                    Away
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="busy">
                    <Circle className="mr-2 h-4 w-4 text-red-500" />
                    Busy
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 