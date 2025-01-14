const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getWorkspaceId() {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name')
    .limit(1)

  if (error) {
    console.error('Error fetching workspace:', error)
    return
  }

  console.log('Available workspace:', data?.[0])
}

getWorkspaceId().catch(console.error) 