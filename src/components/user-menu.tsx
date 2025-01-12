import { useAuth } from '@/contexts/auth-context'
import { useUserStatus } from '@/contexts/user-status-context'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User, Circle, UserCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog"
import { useState } from 'react'

export function UserMenu({ onOpenProfileSettings, isCollapsed }: { onOpenProfileSettings?: () => void, isCollapsed?: boolean }) {
  const { profile, signOut } = useAuth()
  const { userStatuses } = useUserStatus()
  const currentStatus = userStatuses.get(profile?.id || '') || 'offline'
  const { toast } = useToast()
  const [showProfileDialog, setShowProfileDialog] = useState(false)

  if (!profile?.id) return null

  const handleSignOut = async () => {
    try {
      toast({
        title: 'Signing out...',
        description: 'Please wait while we sign you out.',
      })

      await signOut()
    } catch (error: any) {
      console.error('Error signing out:', error)
      toast({
        variant: 'destructive',
        title: 'Error signing out',
        description: error?.message || 'An unexpected error occurred. Please try again.',
      })
    }
  }

  return (
    <div className={`flex ${isCollapsed ? 'flex-col items-center' : 'flex-col items-center space-y-2'}`}>
      <Avatar className="h-10 w-10" status={currentStatus}>
        <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
        <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      {!isCollapsed && (
        <>
          <div className="flex flex-col items-center min-w-0">
            <span className="text-sm font-medium truncate">{profile.username}</span>
            <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-[#4A3B8C]/10">
                  <UserCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>User Profile</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20" status={currentStatus}>
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl">
                        {profile.full_name?.[0] || profile.username?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold">{profile.full_name || profile.username}</h2>
                      {profile.full_name && profile.username && (
                        <p className="text-sm text-muted-foreground">@{profile.username}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${
                          currentStatus === 'online' ? 'bg-green-500' :
                          currentStatus === 'away' ? 'bg-yellow-500' :
                          currentStatus === 'busy' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`} />
                        <p className="text-sm text-muted-foreground">
                          {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {profile.email && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Email</h4>
                        <p className="text-sm">{profile.email}</p>
                      </div>
                    )}
                    {profile.created_at && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Member Since</h4>
                        <p className="text-sm">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => {
                        onOpenProfileSettings?.();
                        setShowProfileDialog(false);
                      }}
                      className="bg-[#4A3B8C] hover:bg-[#3A2E6E]"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={onOpenProfileSettings} className="hover:bg-[#4A3B8C]/10">
              <User className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="hover:bg-[#4A3B8C]/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
} 