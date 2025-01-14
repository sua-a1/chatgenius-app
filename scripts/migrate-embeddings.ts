import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import path from 'path'
import ora from 'ora'

// Load environment variables from chatgenius-app/.env
const envPath = path.resolve(__dirname, '..', '.env')
dotenv.config({ path: envPath })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(`Missing Supabase environment variables in .env:
    NEXT_PUBLIC_SUPABASE_URL: ${!!supabaseUrl}
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: ${!!supabaseKey}
  `)
}

console.log('Supabase URL:', supabaseUrl)
console.log('Service Role Key exists:', !!supabaseKey)

// Initialize Supabase admin client with service role key
const supabase = createClient(supabaseUrl, supabaseKey)

// Test the connection immediately
async function testConnection() {
  try {
    // First test a simple query
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .limit(1)
      .single()

    if (error) {
      console.error('Query error:', error)
      throw error
    }

    console.log('Successfully connected to database')
    return true
  } catch (error) {
    console.error('Connection test error:', error)
    throw error
  }
}

// Initialize OpenAI
const openAIApiKey = process.env.OPENAI_API_KEY
if (!openAIApiKey) {
  throw new Error('Missing OPENAI_API_KEY in .env')
}

const openai = new OpenAI({
  apiKey: openAIApiKey,
})

// Configuration
const BATCH_SIZE = 50
const MODEL = 'text-embedding-ada-002'

async function generateEmbeddings() {
  const spinner = ora('Starting migration...').start()
  
  try {
    // Test connection first
    await testConnection()
    
    spinner.text = 'Fetching messages without embeddings...'

    // Get messages without embeddings using a simpler query
    // First get the message IDs that already have embeddings
    const { data: existingIds, error: idsError } = await supabase
      .from('message_embeddings')
      .select('message_id')

    if (idsError) {
      console.error('Error fetching existing embeddings:', idsError)
      throw idsError
    }

    // Get messages without embeddings
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        channel_id,
        user_id,
        created_at,
        channels!inner (
          workspace_id
        )
      `)
      .not('id', 'in', existingIds?.map(row => row.message_id) || [])
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('Fetch error details:', fetchError)
      throw new Error(`Failed to fetch messages: ${JSON.stringify(fetchError, null, 2)}`)
    }

    console.log('Messages found:', messages?.length || 0)
    if (!messages?.length) {
      spinner.succeed('No messages to process')
      return
    }

    spinner.text = `Processing batch of ${messages.length} messages`

    // Generate embeddings for the batch
    const embeddings = await Promise.all(
      messages.map(async (message) => {
        try {
          const embeddingResponse = await openai.embeddings.create({
            model: MODEL,
            input: message.content,
          })

          return {
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
          }
        } catch (error) {
          console.error(`Error generating embedding for message ${message.id}:`, error)
          return null
        }
      })
    )

    // Filter out any failed embeddings
    const validEmbeddings = embeddings.filter(e => e !== null)

    // Insert embeddings
    if (validEmbeddings.length > 0) {
      spinner.text = `Inserting ${validEmbeddings.length} embeddings...`
      const { error: insertError } = await supabase
        .from('message_embeddings')
        .insert(validEmbeddings)

      if (insertError) {
        throw new Error(`Failed to insert embeddings: ${JSON.stringify(insertError, null, 2)}`)
      }
    }

    spinner.succeed(`Successfully processed ${validEmbeddings.length} messages`)
  } catch (error) {
    spinner.fail('Migration failed')
    if (error instanceof Error) {
      console.error('Error:', error.message)
    } else {
      console.error('Error:', JSON.stringify(error, null, 2))
    }
  }
}

// Run the migration
generateEmbeddings() 