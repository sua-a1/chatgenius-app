'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  redirect(`/app?workspace=${id}`)
} 