import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TEST_WORKSPACE_ID = '02771873-ffb7-4864-994a-f9bfc369f835';

async function testSemanticSearch() {
  try {
    // Test query
    const testQuery = "What are the recent discussions about the project?";
    
    const { data, error } = await supabase.functions.invoke('semantic-search', {
      body: {
        query: testQuery,
        workspace_id: TEST_WORKSPACE_ID,
        top_k: 3,
        similarity_threshold: 0.7
      }
    });

    if (error) throw error;

    console.log('Test Query:', testQuery);
    console.log('\nResults:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testSemanticSearch(); 