'use client'

import { useEffect } from 'react'

export default function SignOutPage() {
  useEffect(() => {
    // Force redirect after 2 seconds if middleware hasn't done it yet
    const timeout = setTimeout(() => {
      window.location.replace('/auth/signin')
    }, 2000)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Signing out...</h1>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
} 