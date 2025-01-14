import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getWorkspaceId() {
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name')
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching workspace:', error)
    process.exit(1)
  }

  console.log('Workspace ID:', workspaces.id)
  return workspaces.id
}

getWorkspaceId().catch(console.error) 