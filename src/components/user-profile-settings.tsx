'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage, UserStatus } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/auth-context'
import { useUserStatus } from '@/contexts/user-status-context'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Circle } from 'lucide-react'

// Import UserProfile type from auth context
import type { UserProfile } from '@/contexts/auth-context'

interface UserProfileSettingsProps {
  onClose: () => void
}

export function UserProfileSettings({ onClose }: UserProfileSettingsProps) {
  const { user, profile: initialProfile, refreshProfile } = useAuth()
  const { userStatuses, updateMyStatus } = useUserStatus()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<'auto' | UserStatus>('auto')
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // Initialize selected status
  useEffect(() => {
    if (user?.id) {
      const currentStatus = userStatuses.get(user.id)
      setSelectedStatus(currentStatus || 'auto')
    }
  }, [user?.id, userStatuses])

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
        status: initialProfile?.status,
        created_at: initialProfile?.created_at || user.created_at || new Date().toISOString(),
        updated_at: initialProfile?.updated_at || new Date().toISOString()
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

  const handleStatusChange = async (value: string) => {
    const status = value as 'auto' | UserStatus
    console.log('Status change requested:', { value, status })
    
    try {
      // Update the UI immediately
      setSelectedStatus(status)
      
      // Update the status in the context
      console.log('Updating status:', status)
      await updateMyStatus(status)
      
      // Show success message
      toast({
        title: 'Status Updated',
        description: status === 'auto' 
          ? 'Automatic status tracking enabled.' 
          : `Your status has been set to ${status}.`,
      })
    } catch (error: any) {
      console.error('Failed to update status:', error)
      
      // Show error message
      toast({
        title: 'Error',
        description: 'Failed to update your status. Please try again.',
        variant: 'destructive',
      })
      
      // Revert the selected status
      if (user?.id) {
        setSelectedStatus(userStatuses.get(user.id) || 'auto')
      }
    }
  }

  // Check if there are any unsaved profile changes
  const hasProfileChanges = () => {
    if (!initialProfile || !profile) return false
    
    const profileNotifications = profile.notifications || { email: true, push: false }
    const initialNotifications = initialProfile.notifications || { email: true, push: false }
    
    return (
      profile.username !== initialProfile.username ||
      profile.full_name !== initialProfile.full_name ||
      profile.avatar_url !== initialProfile.avatar_url ||
      profileNotifications.email !== initialNotifications.email ||
      profileNotifications.push !== initialNotifications.push ||
      profile.theme !== initialProfile.theme
    )
  }

  const handleSave = async () => {
    if (!user?.id || !profile) {
      console.log('No user or profile, closing')
      onClose()
      return
    }
    
    if (!hasProfileChanges()) {
      console.log('No changes detected, closing')
      onClose()
      return
    }

    try {
      setIsSaving(true)
      console.log('Starting save operation...')

      // Update user profile in database first
      const { error: profileError } = await supabase
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

      if (profileError) {
        console.error('Profile update error:', profileError)
        throw profileError
      }

      console.log('Profile updated in database')

      // Show success toast immediately after database update
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully. Page will reload to apply changes.',
      })

      // Close the dialog
      onClose()

      // Force reload after a short delay
      setTimeout(() => {
        console.log('Reloading page...')
        window.location.reload()
      }, 1000)

      // Update auth metadata in the background
      supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }
      }).then(({ error }) => {
        if (error) {
          console.error('Auth update error:', error)
        } else {
          console.log('Auth metadata updated')
        }
      })

    } catch (error: any) {
      console.error('Save operation failed:', error)
      setIsSaving(false)
      
      toast({
        title: 'Error updating profile',
        description: error.message || 'Could not update profile. Please try again.',
        variant: 'destructive',
      })
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
        <div>
          <Label>Presence Status</Label>
          <RadioGroup
            value={selectedStatus}
            onValueChange={handleStatusChange}
            className="mt-2 space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="auto" id="auto" />
              <Label htmlFor="auto" className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-green-500 fill-current" />
                Automatic
                <span className="text-sm text-muted-foreground">(detects when you're active)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="away" id="away" />
              <Label htmlFor="away" className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-yellow-500" />
                Away
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="busy" id="busy" />
              <Label htmlFor="busy" className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-red-500" />
                Busy
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

