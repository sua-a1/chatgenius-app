import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')?.split(' ')[1]
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client using the edge function URL
    const supabaseUrl = Deno.env.get('APP_EDGE_FUNCTION_URL')?.replace('/functions/v1', '')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authorization token' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    console.log('OpenAI API Key exists:', !!openAIApiKey)

    if (!openAIApiKey) {
      throw new Error('Missing OpenAI API key')
    }

    const openAIConfig = new Configuration({
      apiKey: openAIApiKey,
    })
    const openai = new OpenAIApi(openAIConfig)

    console.log('Fetching messages without embeddings...')

    // Get messages without embeddings
    const { data: messages, error: fetchError } = await supabaseClient
      .from('messages')
      .select(`
        id,
        content,
        topic,
        channel_id,
        user_id,
        private,
        created_at,
        channels!inner (
          workspace_id
        )
      `)
      .not('id', 'in', (
        supabaseClient
          .from('message_embeddings')
          .select('message_id')
      ))
      .eq('private', false)  // Only process non-private messages
      .limit(5) // Start with a small batch for testing

    if (fetchError) {
      console.error('Error fetching messages:', JSON.stringify(fetchError, null, 2))
      throw fetchError
    }

    console.log('Messages found:', messages?.length || 0)
    if (messages?.length) {
      console.log('First message:', JSON.stringify(messages[0], null, 2))
    }

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ message: 'No new messages to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${messages.length} messages...`)

    // Generate embeddings
    const embeddings = await Promise.all(
      messages.map(async (message) => {
        try {
          console.log(`Generating embedding for message ${message.id}`)
          const { data: embeddingResponse } = await openai.createEmbedding({
            model: 'text-embedding-ada-002',
            input: message.content,
          })

          console.log(`Generated embedding with ${embeddingResponse.data[0].embedding.length} dimensions`)

          return {
            message_id: message.id,
            embedding: embeddingResponse.data[0].embedding,
            channel_id: message.channel_id,
            user_id: message.user_id,
            workspace_id: message.channels.workspace_id,
            original_message_content: message.content,
            metadata: {
              content: message.content,
              created_at: message.created_at,
              embedding_created_at: new Date().toISOString()
            }
          }
        } catch (error) {
          console.error(`Error generating embedding for message ${message.id}:`, JSON.stringify(error, null, 2))
          throw error
        }
      })
    )

    console.log('Generated embeddings, inserting into database...')

    // Insert embeddings
    const { error: insertError } = await supabaseClient
      .from('message_embeddings')
      .insert(embeddings)

    if (insertError) {
      console.error('Error inserting embeddings:', JSON.stringify(insertError, null, 2))
      throw insertError
    }

    console.log('Successfully inserted embeddings')

    return new Response(
      JSON.stringify({ 
        message: `Successfully processed ${messages.length} messages`,
        success: true,
        messageIds: messages.map(m => m.id)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', JSON.stringify({
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
      error
    }, null, 2))
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.response?.data || error,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 