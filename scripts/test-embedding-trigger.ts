import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface Channel {
  id: string
  is_private: boolean
}

async function testTrigger() {
  console.log('Starting trigger test...')

  // Create test channels
  const { data: channels, error: channelError } = await supabase
    .from('channels')
    .insert([
      { name: 'Test Public Channel', is_private: false },
      { name: 'Test Private Channel', is_private: true }
    ])
    .select('id, is_private')

  if (channelError) {
    console.error('Error creating channels:', channelError)
    process.exit(1)
  }

  console.log('Created test channels:', channels)

  const publicChannel = channels?.find((c: Channel) => !c.is_private)
  const privateChannel = channels?.find((c: Channel) => c.is_private)

  if (!publicChannel || !privateChannel) {
    console.error('Failed to create test channels')
    process.exit(1)
  }

  // Check channel privacy status
  const { data: channelCheck, error: checkError } = await supabase
    .from('channels')
    .select('is_private')
    .eq('id', publicChannel.id)
    .single()

  console.log('Channel privacy check:', channelCheck)

  // Insert message
  const { data: publicMessage, error: publicMsgError } = await supabase
    .from('messages')
    .insert({
      content: 'Test message in public channel',
      channel_id: publicChannel.id,
      reply_count: 0,
      attachments: []
    })
    .select('id')
    .single()

  if (publicMsgError) {
    console.error('Error creating public message:', publicMsgError)
  } else {
    console.log('Created public message:', publicMessage)

    // Check if message was added to pending_embeddings
    const { data: pendingCheck, error: pendingError } = await supabase
      .from('pending_embeddings')
      .select('*')
      .eq('message_id', publicMessage.id)
      .single()

    if (pendingError) {
      console.error('Error checking pending embeddings:', pendingError)
    } else {
      console.log('Pending embedding status:', pendingCheck)
    }
  }

  // Wait a moment for trigger to execute
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Check pending_embeddings table for any messages in our test channels
  const { data: pendingEmbeddings, error: pendingError } = await supabase
    .from('pending_embeddings')
    .select('message_id')
    .eq('status', 'pending')
    .eq('message_id', publicMessage?.id)

  if (pendingError) {
    console.error('Error checking pending embeddings:', pendingError)
  }

  // Verify results
  console.log('\nTest Results:')
  console.log('-------------')
  console.log('Message trigger:', pendingEmbeddings?.length > 0 ? 'PASSED ✓' : 'FAILED ✗')

  // Cleanup
  const { error: cleanupMsgError } = await supabase
    .from('messages')
    .delete()
    .eq('channel_id', publicChannel.id)

  if (cleanupMsgError) {
    console.error('Error cleaning up public channel messages:', cleanupMsgError)
  }

  const { error: cleanupPrivateMsgError } = await supabase
    .from('messages')
    .delete()
    .eq('channel_id', privateChannel.id)

  if (cleanupPrivateMsgError) {
    console.error('Error cleaning up private channel messages:', cleanupPrivateMsgError)
  }

  const { error: cleanupChannelError } = await supabase
    .from('channels')
    .delete()
    .in('id', [publicChannel.id, privateChannel.id])

  if (cleanupChannelError) {
    console.error('Error cleaning up channels:', cleanupChannelError)
  }

  console.log('\nTest cleanup completed')
}

testTrigger().catch(console.error) 