'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Circle, Upload } from 'lucide-react'
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<'auto' | UserStatus>('auto')
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED') {
        // Handle any profile update
        setIsUploadingAvatar(false);
        setIsSaving(false);
        onClose();
        // Reload immediately after dialog closes
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onClose]);

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
      onClose();
      return;
    }
    
    if (!hasProfileChanges()) {
      onClose();
      return;
    }

    // Prevent multiple saves
    if (isSaving) return;

    try {
      setIsSaving(true);

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
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update auth metadata - this will trigger the auth state change event
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }
      });

      if (authError) throw authError;

      // Show success message
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });

    } catch (error: any) {
      console.error('Save operation failed:', error);
      setIsSaving(false);
      toast({
        title: 'Error updating profile',
        description: error.message || 'Could not update profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !profile) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please select an image file.',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please select an image under 5MB.',
      });
      return;
    }

    try {
      setIsUploadingAvatar(true);

      // Create optimized file name
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldFilePath = profile.avatar_url.split('/').slice(-2).join('/');
        if (oldFilePath) {
          await supabase.storage
            .from('avatars')
            .remove([oldFilePath]);
        }
      }

      // Upload the new file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update auth metadata - this will trigger the auth state change event
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (authError) throw authError;

      // Show success message
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully.',
      });

      // Close dialog and reload after a delay
      onClose();
      // Use shorter delay for reload
      setTimeout(() => {
        window.location.reload();
      }, 100);

    } catch (error: any) {
      console.error('Error in avatar update process:', error);
      setIsUploadingAvatar(false);
      toast({
        variant: 'destructive',
        title: 'Error updating avatar',
        description: error.message || 'There was a problem updating your profile picture.',
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Profile Settings</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <Avatar className={`h-20 w-20 transition-opacity ${isUploadingAvatar ? 'opacity-50' : 'group-hover:opacity-75'}`}>
              <AvatarImage 
                src={profile.avatar_url || undefined} 
                className="object-cover"
              />
              <AvatarFallback className="text-2xl">
              {profile.full_name?.[0] || profile.username?.[0] || profile.email?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
            {!isUploadingAvatar && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-full cursor-pointer"
                onClick={handleAvatarClick}
              >
                <Upload className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <Button 
            onClick={handleAvatarClick}
            disabled={isUploadingAvatar}
          >
            {isUploadingAvatar ? 'Uploading...' : 'Change Avatar'}
          </Button>
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
    </DialogContent>
  )
}

