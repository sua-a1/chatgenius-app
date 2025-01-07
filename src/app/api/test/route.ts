import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Try to query the users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Successfully connected to Supabase!',
      data,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to connect to Supabase',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 