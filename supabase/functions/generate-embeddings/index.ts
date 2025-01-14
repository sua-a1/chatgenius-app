import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
  id: string
  content: string
  workspace_id: string
  channel_id: string
  user_id: string
  replied_to_user?: string
  chunk_index?: number
}

interface APIError extends Error {
  response?: {
    status: number
    data: unknown
  }
}

// Constants for configuration
const BATCH_SIZE = 100
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

// Preprocess message content
function preprocessMessage(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim()
}

// Split long messages into chunks
function chunkMessage(content: string, maxLength = 1000): string[] {
  if (content.length <= maxLength) return [content]
  
  const chunks: string[] = []
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content]
  
  let currentChunk = ''
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence
    } else {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = sentence
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())
  
  return chunks
}

// Retry mechanism for API calls
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const apiError = error as APIError
    if (retries > 0 && apiError.response?.status === 429) { // Rate limit error
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return withRetry(fn, retries - 1)
    }
    throw error
  }
}

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // @ts-ignore: Deno exists in edge function environment
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // @ts-ignore: Deno exists in edge function environment
    const openAIConfig = new Configuration({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })
    const openai = new OpenAIApi(openAIConfig)

    // Get messages that don't have embeddings yet
    const { data: messages, error: fetchError } = await supabaseClient
      .from('messages')
      .select('id, content, workspace_id, channel_id, user_id, replied_to_user')
      .not('id', 'in', (
        supabaseClient
          .from('message_embeddings')
          .select('message_id')
      ))
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw fetchError
    }

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ message: 'No new messages to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedMessages = messages.flatMap((message: Message) => {
      const preprocessed = preprocessMessage(message.content)
      const chunks = chunkMessage(preprocessed)
      return chunks.map((chunk, index) => ({
        ...message,
        content: chunk,
        chunk_index: index,
      }))
    })

    const embeddings = await Promise.all(
      processedMessages.map(async (message: Message) => {
        const { data: embeddingResponse } = await withRetry(async () => 
          await openai.createEmbedding({
            model: 'text-embedding-ada-002',
            input: message.content,
          })
        )

        return {
          message_id: message.id,
          embedding: embeddingResponse.data[0].embedding,
          metadata: { 
            content: message.content,
            chunk_index: message.chunk_index,
            total_chunks: processedMessages.filter((m: Message) => m.id === message.id).length,
            user_id: message.user_id,
            replied_to_user: message.replied_to_user,
            timestamp: new Date().toISOString()
          },
          workspace_id: message.workspace_id,
          channel_id: message.channel_id,
          user_id: message.user_id
        }
      })
    )

    // Insert embeddings in batches
    const batchSize = 20
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize)
      const { error: insertError } = await supabaseClient
        .from('message_embeddings')
        .insert(batch)

      if (insertError) {
        console.error(`Error inserting batch ${i/batchSize}:`, insertError)
        throw insertError
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${messages.length} messages into ${embeddings.length} embeddings`,
        success: true 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    const apiError = error as APIError
    console.error('Error processing messages:', apiError)
    return new Response(
      JSON.stringify({ 
        error: apiError.message,
        details: apiError.response?.data || apiError
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: apiError.response?.status || 500,
      }
    )
  }
}) 