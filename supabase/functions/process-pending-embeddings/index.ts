import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const isScheduledInvocation = req.headers.get('x-scheduled-function') === 'true'
  console.log('Function invoked:', new Date().toISOString(), { isScheduledInvocation })
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')

    // Validate environment variables
    if (!supabaseUrl || !supabaseKey || !openAIApiKey) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey,
        hasOpenAIKey: !!openAIApiKey
      })
      throw new Error('Missing required environment variables')
    }

    // Initialize Supabase client with service role key for internal operations
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Initialize OpenAI
    const openai = new OpenAIApi(new Configuration({
      apiKey: openAIApiKey,
    }))

    console.log('Fetching pending messages...')

    // Get pending messages
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('pending_embeddings')
      .select(`
        id,
        message_id,
        messages (
          id,
          content,
          channel_id,
          user_id,
          created_at,
          channels (
            workspace_id
          )
        )
      `)
      .eq('status', 'pending')
      .limit(50)

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError)
      throw fetchError
    }

    if (!pendingMessages?.length) {
      console.log('No pending messages to process')
      return new Response(
        JSON.stringify({ 
          message: 'No pending messages to process',
          isScheduledInvocation,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingMessages.length} messages...`)

    // Process each pending message
    const results = await Promise.all(
      pendingMessages.map(async (pending) => {
        try {
          const message = pending.messages
          if (!message) {
            console.error('Message not found for pending ID:', pending.id)
            throw new Error('Message not found')
          }

          console.log(`Generating embedding for message ${message.id}: "${message.content.substring(0, 50)}..."`)

          // Generate embedding
          const { data: embeddingResponse } = await openai.createEmbedding({
            model: 'text-embedding-ada-002',
            input: message.content,
          })

          console.log(`Successfully generated embedding for message ${message.id}`)

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
            console.error(`Error storing embedding for message ${message.id}:`, insertError)
            throw insertError
          }

          console.log(`Successfully stored embedding for message ${message.id}`)

          // Update pending status to completed
          await supabase
            .from('pending_embeddings')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', pending.id)

          console.log(`Marked message ${message.id} as completed`)

          return { success: true, message_id: message.id }
        } catch (error) {
          console.error(`Error processing message ${pending.message_id}:`, error)

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

          return { success: false, message_id: pending.message_id, error: error.message }
        }
      })
    )

    console.log('Finished processing all messages:', results)

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} messages`,
        results,
        isScheduledInvocation,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Fatal error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        isScheduledInvocation,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 