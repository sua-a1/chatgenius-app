const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getWorkspaceInfo() {
  console.log('Checking workspaces...')
  const { data: workspaces, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')

  if (workspaceError) {
    console.error('Error fetching workspaces:', workspaceError)
    return
  }

  console.log('\nWorkspaces:', workspaces)

  console.log('\nChecking users...')
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')

  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }

  console.log('\nUsers:', users)

  console.log('\nChecking workspace members...')
  const { data: members, error: memberError } = await supabase
    .from('workspace_members')
    .select('*')

  if (memberError) {
    console.error('Error fetching workspace members:', memberError)
    return
  }

  console.log('\nWorkspace Members:', members)
}

getWorkspaceInfo().catch(console.error) 