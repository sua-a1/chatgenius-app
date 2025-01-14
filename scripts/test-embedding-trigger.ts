import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testEmbeddingTrigger() {
  console.log('Testing message embedding trigger...')

  // Insert a test message
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      content: 'Test message for embedding trigger',
      channel_id: 'test-channel',
      user_id: 'test-user'
    })
    .select()
    .single()

  if (msgError) {
    console.error('Error inserting test message:', msgError)
    return
  }

  console.log('Test message inserted:', message.id)

  // Wait a moment for the trigger to process
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Check for pending embeddings
  const { data: pendingEmbeddings, error: embedError } = await supabase
    .from('message_embeddings')
    .select()
    .eq('message_id', message.id)

  if (embedError) {
    console.error('Error checking embeddings:', embedError)
    return
  }

  console.log('\nTest Results:')
  console.log('-------------')
  console.log('Message trigger:', (pendingEmbeddings && pendingEmbeddings.length > 0) ? 'PASSED ✓' : 'FAILED ✗')

  // Cleanup
  const { error: cleanupMsgError } = await supabase
    .from('messages')
    .delete()
    .eq('id', message.id)

  if (cleanupMsgError) {
    console.error('Error cleaning up test message:', cleanupMsgError)
  }

  const { error: cleanupEmbedError } = await supabase
    .from('message_embeddings')
    .delete()
    .eq('message_id', message.id)

  if (cleanupEmbedError) {
    console.error('Error cleaning up test embedding:', cleanupEmbedError)
  }

  console.log('\nCleanup complete')
}

testEmbeddingTrigger().catch(console.error) 