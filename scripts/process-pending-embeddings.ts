import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import 'dotenv/config'

interface Channel {
  workspace_id: string
}

interface Message {
  id: string
  content: string
  channel_id: string
  user_id: string
  created_at: string
  channels: Channel
}

interface PendingEmbedding {
  id: string
  message_id: string
  messages: Message
}

type DatabasePendingEmbedding = Omit<PendingEmbedding, 'messages'> & {
  messages: Message
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  throw new Error('Missing environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const openai = new OpenAI({ apiKey: openaiApiKey })

async function processPendingEmbeddings() {
  console.log('Fetching pending messages...')
  
  // Get pending messages
  const { data: pendingMessages, error: fetchError } = await supabase
    .from('pending_embeddings')
    .select(`
      id,
      message_id,
      messages!inner (
        id,
        content,
        channel_id,
        user_id,
        created_at,
        channels!inner (
          workspace_id
        )
      )
    `)
    .eq('status', 'pending')
    .limit(50) as { data: DatabasePendingEmbedding[] | null, error: any }

  if (fetchError) {
    console.error('Error fetching pending messages:', fetchError)
    return
  }

  if (!pendingMessages?.length) {
    console.log('No pending messages to process')
    return
  }

  console.log(`Processing ${pendingMessages.length} messages...`)

  // Process each pending message
  for (const pending of pendingMessages) {
    try {
      const message = pending.messages
      if (!message) {
        throw new Error('Message not found')
      }

      console.log(`\nProcessing message: "${message.content}"`)

      // Generate embedding
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: message.content,
      })

      console.log('Generated embedding, storing in database...')

      // Store embedding
      const { error: insertError } = await supabase
        .from('message_embeddings')
        .insert({
          message_id: message.id,
          embedding: embeddingResponse.data[0].embedding,
          channel_id: message.channel_id,
          user_id: message.user_id,
          workspace_id: message.channels.workspace_id,
          metadata: {
            content: message.content,
            created_at: message.created_at,
            embedding_created_at: new Date().toISOString()
          }
        })

      if (insertError) {
        throw insertError
      }

      // Update pending status to completed
      const { error: updateError } = await supabase
        .from('pending_embeddings')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', pending.id)

      if (updateError) {
        throw updateError
      }

      console.log('Successfully processed message')
    } catch (error: any) {
      console.error('Error processing message:', error)

      // Update pending status to failed
      await supabase
        .from('pending_embeddings')
        .update({
          status: 'failed',
          error_message: error.message,
          last_attempt: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', pending.id)
    }
  }

  console.log('\nFinished processing messages')
}

processPendingEmbeddings().catch(console.error) 