import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function generateEmbeddings() {
  try {
    console.log('Invoking test-embeddings function...')
    const { data, error } = await supabase.functions.invoke('test-embeddings', {
      body: { },
    })

    if (error) {
      console.error('Error:', error)
      return
    }

    console.log('Response:', data)
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the function
generateEmbeddings() 