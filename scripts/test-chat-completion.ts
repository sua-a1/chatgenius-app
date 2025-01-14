import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Test configuration
const TEST_WORKSPACE_ID = '02771873-ffb7-4864-994a-f9bfc369f835';
const TEST_CHANNEL_ID = 'c0148a10-262f-4af5-9fa7-11c92331201d';  // From our previous test results
const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';  // Default system user ID

async function testChatCompletion(query: string, options: {
  conversation_id?: string;
  channel_id?: string;
  user_id?: string;
} = {}) {
  const conversation_id = options.conversation_id || uuidv4();
  
  try {
    console.log('\n=== Testing Query ===');
    console.log('Query:', query);
    if (options.channel_id) console.log('Channel Context: Yes');
    if (options.user_id) console.log('User Context: Yes');
    
    const { data, error } = await supabase.functions.invoke('chat-completion', {
      body: {
        conversation_id,
        message: query,
        workspace_id: TEST_WORKSPACE_ID,
        channel_id: options.channel_id,
        user_id: options.user_id || TEST_USER_ID
      }
    });

    if (error) throw error;

    console.log('\nResponse:');
    console.log(data.message);
    console.log('\n-------------------');

    return { conversation_id, data };
  } catch (error) {
    console.error('Error:', error);
    return { conversation_id, error };
  }
}

async function runTests() {
  console.log('Starting Chat Completion Tests...\n');

  // Test 1: General workspace query
  await testChatCompletion(
    "What are the main topics being discussed in this workspace?"
  );

  // Test 2: Channel-specific query
  await testChatCompletion(
    "What were the recent discussions in this channel?",
    { channel_id: TEST_CHANNEL_ID }
  );

  // Test 3: User-specific query
  await testChatCompletion(
    "What has this user been working on?",
    { user_id: TEST_USER_ID }
  );

  // Test 4: Conversation continuity
  const { conversation_id } = await testChatCompletion(
    "Tell me about the project documentation."
  );

  // Follow-up question in the same conversation
  await testChatCompletion(
    "What specific topics does it cover?",
    { conversation_id }
  );

  // Test 5: Combined channel and user context
  await testChatCompletion(
    "What has this user discussed in this channel?",
    {
      channel_id: TEST_CHANNEL_ID,
      user_id: TEST_USER_ID
    }
  );
}

// Run the tests
runTests(); 