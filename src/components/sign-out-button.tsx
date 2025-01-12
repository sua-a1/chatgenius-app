'use client'

import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = () => {
    router.push('/auth/sign-out')
  }

  return (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={handleSignOut}
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  )
} 