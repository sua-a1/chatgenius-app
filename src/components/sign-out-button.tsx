'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      
      // Clear any app-specific state/storage here
      localStorage.removeItem('lastWorkspace')
      localStorage.removeItem('lastChannel')
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Force a router refresh to clear server-side auth state
      router.refresh()
      
      // Redirect to sign in page
      router.push('/auth/signin')
    } catch (error: any) {
      console.error('Error signing out:', error)
      toast({
        variant: 'destructive',
        title: 'Error signing out',
        description: error.message || 'Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={handleSignOut}
      disabled={isLoading}
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  )
} 