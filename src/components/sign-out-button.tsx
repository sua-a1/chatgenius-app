'use client'

import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  return (
    <form action="/auth/sign-out" method="POST">
      <Button 
        variant="ghost" 
        size="icon"
        type="submit"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  )
} 