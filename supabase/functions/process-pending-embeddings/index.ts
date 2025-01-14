import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2h3amptaWRjdWN2dnhneGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ5ODIxODAsImV4cCI6MjAyMDU1ODE4MH0.SYLqEjz_UHRDKaY_ufHNcGBqwwx0lKGb2R6luZXjxZQ'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes(ANON_KEY)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client with service role key for internal operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Initialize OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) {
      throw new Error('Missing OpenAI API key')
    }

    const openai = new OpenAIApi(new Configuration({
      apiKey: openAIApiKey,
    }))

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
      throw fetchError
    }

    if (!pendingMessages?.length) {
      return new Response(
        JSON.stringify({ message: 'No pending messages to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process each pending message
    const results = await Promise.all(
      pendingMessages.map(async (pending) => {
        try {
          const message = pending.messages
          if (!message) {
            throw new Error('Message not found')
          }

          // Generate embedding
          const { data: embeddingResponse } = await openai.createEmbedding({
            model: 'text-embedding-ada-002',
            input: message.content,
          })

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
          await supabase
            .from('pending_embeddings')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', pending.id)

          return { success: true, message_id: message.id }
        } catch (error) {
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

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} messages`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 