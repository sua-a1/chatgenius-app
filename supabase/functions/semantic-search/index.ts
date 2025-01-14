// @ts-ignore: Deno deployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

// Types for our database response
interface MessageSearchResult {
  message_id: string;
  content: string;
  similarity: number;
  channel_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface SearchRequest {
  query: string;
  workspace_id: string;
  top_k?: number;
  similarity_threshold?: number;
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  try {
    const { query, workspace_id, top_k = 5, similarity_threshold = 0.7 } = await req.json() as SearchRequest;

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const vector = embeddingResponse.data[0].embedding;

    // Perform semantic search with workspace context
    const { data: similarMessages, error } = await supabaseClient
      .rpc('search_messages', {
        query_embedding: vector,
        workspace_filter: workspace_id,
        match_count: top_k,
        similarity_threshold: similarity_threshold
      }) as { data: MessageSearchResult[] | null, error: Error | null };

    if (error) throw error;

    return new Response(
      JSON.stringify({
        messages: similarMessages
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in semantic-search:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
}); 