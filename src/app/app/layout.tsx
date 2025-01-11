'use client'

import { redirect } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, isInitialized } = useAuth()

  // If auth is initialized and there's no profile, redirect to sign in
  if (isInitialized && !profile) {
    redirect('/auth/sign-in')
  }

  return children
} 