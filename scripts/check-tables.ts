const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTables() {
  // Get a sample message to see its structure
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .limit(1)
    .single()

  if (messageError) {
    console.error('Error fetching message:', messageError)
  } else {
    console.log('Message structure:', message)
  }
}

checkTables().catch(console.error) 