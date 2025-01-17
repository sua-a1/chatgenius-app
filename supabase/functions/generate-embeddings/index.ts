import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

console.log('Loading generate-embeddings function...')

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get pending messages with workspace_id from channels
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
      .limit(50)

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending messages' }),
        { status: 500 }
      )
    }

    if (!pendingMessages?.length) {
      return new Response(
        JSON.stringify({ message: 'No pending messages to process' }),
        { status: 200 }
      )
    }

    console.log(`Found ${pendingMessages.length} pending messages`)

    // Generate embedding using OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('Missing OpenAI API key')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500 }
      )
    }

    // Process each pending message
    for (const pending of pendingMessages) {
      const message = pending.messages
      if (!message || !message.channels?.workspace_id) {
        console.error('Message or workspace_id not found for pending ID:', pending.id)
        continue
      }

      try {
        console.log(`Processing message ${message.id}...`)

        // Mark as processing
        const { error: updateError } = await supabase
          .from('pending_embeddings')
          .update({ 
            status: 'processing',
            last_attempt: new Date().toISOString(),
            attempts: (pending.attempts || 0) + 1
          })
          .eq('id', pending.id)

        if (updateError) {
          console.error('Error updating status to processing:', updateError)
          continue
        }

        // Generate embedding
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: message.content,
            model: 'text-embedding-ada-002'
          })
        })

        if (!embeddingResponse.ok) {
          throw new Error(await embeddingResponse.text())
        }

        const { data } = await embeddingResponse.json()

        // Store embedding with workspace_id
        const { error: insertError } = await supabase
          .from('message_embeddings')
          .insert({
            message_id: message.id,
            channel_id: message.channel_id,
            user_id: message.user_id,
            workspace_id: message.channels.workspace_id,
            embedding: data[0].embedding,
            original_message_content: message.content,
            metadata: {
              content: message.content,
              created_at: new Date().toISOString()
            }
          })

        if (insertError) {
          console.error('Error storing embedding:', insertError)
          throw insertError
        }

        // Mark as completed
        const { error: completeError } = await supabase
          .from('pending_embeddings')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', pending.id)

        if (completeError) {
          console.error('Error marking as completed:', completeError)
          continue
        }

        console.log('Successfully processed message:', message.id)
      } catch (error) {
        console.error('Error processing message:', error)
        
        // Mark as failed
        await supabase
          .from('pending_embeddings')
          .update({ 
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', pending.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: pendingMessages.length
      }),
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
}) 