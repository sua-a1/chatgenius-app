import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  throw new Error('Missing environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const openai = new OpenAI({ apiKey: openaiApiKey })

const BATCH_SIZE = 10

async function getMessages(lastProcessedId: string | null = null) {
  let query = supabase
    .from('messages')
    .select(`
      id,
      content,
      created_at,
      user_id,
      channel_id,
      channels (
        workspace_id
      )
    `)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (lastProcessedId) {
    query = query.gt('id', lastProcessedId)
  }

  return await query
}

async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  })
  return response.data[0].embedding
}

async function processMessage(message: any) {
  try {
    if (!message.content || !message.channels?.workspace_id) {
      console.log('Skipping message due to missing content or workspace_id:', message.id)
      return true
    }

    // Check if embedding already exists
    const { data: existing } = await supabase
      .from('message_embeddings')
      .select('id')
      .eq('message_id', message.id)
      .maybeSingle()

    if (existing) {
      console.log('Embedding already exists for message:', message.id)
      return true
    }

    // Generate embedding
    const embedding = await generateEmbedding(message.content)

    // Store embedding
    const { error: insertError } = await supabase
      .from('message_embeddings')
      .insert({
        message_id: message.id,
        embedding,
        channel_id: message.channel_id,
        user_id: message.user_id,
        workspace_id: message.channels.workspace_id,
        metadata: {
          content: message.content,
          created_at: message.created_at,
          channel_id: message.channel_id,
          user_id: message.user_id
        }
      })

    if (insertError) {
      console.error('Error inserting embedding:', insertError)
      return false
    }

    console.log('Successfully processed message:', message.id)
    return true
  } catch (error) {
    console.error('Error processing message:', message.id, error)
    return false
  }
}

async function migrateEmbeddings() {
  let lastProcessedId: string | null = null
  let totalProcessed = 0
  let batchNumber = 1

  while (true) {
    console.log(`\nProcessing batch ${batchNumber}...`)
    
    const { data: messages, error } = await getMessages(lastProcessedId)
    
    if (error) {
      console.error('Error fetching messages:', error)
      break
    }

    if (!messages || messages.length === 0) {
      console.log('No more messages to process')
      break
    }

    for (const message of messages) {
      const success = await processMessage(message)
      if (success) {
        totalProcessed++
      }
      lastProcessedId = message.id
    }

    console.log(`Batch ${batchNumber} complete. Total processed: ${totalProcessed}`)
    batchNumber++
  }

  console.log('\nMigration complete!')
  console.log('Total messages processed:', totalProcessed)
}

migrateEmbeddings().catch(console.error) 