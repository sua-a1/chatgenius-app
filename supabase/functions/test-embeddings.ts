import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Call the generate-embeddings function
const response = await fetch(
  `${supabaseUrl}/functions/v1/generate-embeddings`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  }
)

const result = await response.json()
console.log('Result:', result) 