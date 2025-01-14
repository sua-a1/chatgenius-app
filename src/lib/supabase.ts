import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { env } from './env'

// Create a single instance of the Supabase client
const supabase = createClientComponentClient({
  supabaseUrl: env.supabase.url,
  supabaseKey: env.supabase.anonKey,
})

export { supabase } 