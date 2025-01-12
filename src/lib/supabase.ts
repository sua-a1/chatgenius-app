import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Create a single instance of the Supabase client
const supabase = createClientComponentClient({
  options: {
    global: {
      headers: {
        'x-client-info': 'chatgenius',
      },
    },
  },
})

export { supabase } 