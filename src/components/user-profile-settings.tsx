'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/auth-context'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'

// Import UserProfile type from auth context
import type { UserProfile } from '@/contexts/auth-context'

interface UserProfileSettingsProps {
  onClose: () => void
}

export function UserProfileSettings({ onClose }: UserProfileSettingsProps) {
  const { user, profile: initialProfile, refreshProfile } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const initializeProfile = () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      const defaultProfile: UserProfile = {
        id: user.id,
        username: initialProfile?.username || user.email?.split('@')[0] || '',
        email: user.email || '',
        avatar_url: initialProfile?.avatar_url || user.user_metadata?.avatar_url || null,
        full_name: initialProfile?.full_name || user.user_metadata?.full_name || null,
        notifications: initialProfile?.notifications || {
      email: true,
      push: false,
    },
        theme: initialProfile?.theme || 'light',
        updated_at: initialProfile?.updated_at || new Date().toISOString(),
      }

      setProfile(defaultProfile)
      setIsLoading(false)
    }

    initializeProfile()
  }, [user, initialProfile])

  const handleInputChange = (key: keyof UserProfile, value: any) => {
    if (!profile) return
    setProfile((prev: UserProfile | null) => ({ ...prev!, [key]: value }))
  }

  const handleNotificationChange = (key: keyof UserProfile['notifications'], value: boolean) => {
    if (!profile) return
    setProfile((prev: UserProfile | null) => ({
      ...prev!,
      notifications: {
        ...prev!.notifications,
        [key]: value,
      },
    }))
  }

  const handleSave = async () => {
    if (!user?.id || !profile) return

    setIsSaving(true)
    try {
      // Update user metadata in auth
      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }
      })

      if (updateAuthError) throw updateAuthError

      // Update user profile in database
      const { error: updateProfileError } = await supabase
        .from('users')
        .update({
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          notifications: profile.notifications,
          theme: profile.theme,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateProfileError) throw updateProfileError

      // Refresh the profile in auth context
      await refreshProfile()

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      })
      
      onClose()
    } catch (error: any) {
      toast({
        title: 'Error updating profile',
        description: error.message || 'Could not update profile',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="flex justify-center items-center h-[400px]">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Profile Settings</h2>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>
              {profile.full_name?.[0] || profile.username?.[0] || profile.email?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          <Button disabled>Change Avatar</Button>
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={profile.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={profile.full_name || ''}
            onChange={(e) => handleInputChange('full_name', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            disabled
          />
        </div>
        <div>
          <Label>Notifications</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="emailNotifications"
                checked={profile.notifications.email}
                onCheckedChange={(checked) => handleNotificationChange('email', checked)}
              />
              <Label htmlFor="emailNotifications">Email Notifications</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="pushNotifications"
                checked={profile.notifications.push}
                onCheckedChange={(checked) => handleNotificationChange('push', checked)}
              />
              <Label htmlFor="pushNotifications">Push Notifications</Label>
            </div>
          </div>
        </div>
        <div>
          <Label>Theme</Label>
          <div className="flex space-x-4">
            <Button
              variant={profile.theme === 'light' ? 'default' : 'outline'}
              onClick={() => handleInputChange('theme', 'light')}
            >
              Light
            </Button>
            <Button
              variant={profile.theme === 'dark' ? 'default' : 'outline'}
              onClick={() => handleInputChange('theme', 'dark')}
            >
              Dark
            </Button>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

