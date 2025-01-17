# API Endpoints Documentation

## AI Chat Endpoints

### POST /api/ai/chat/message
Creates a new AI chat message and generates a response.

#### Request
```typescript
{
  conversationId: string;
  message: string;
  workspaceId: string;
}
```

#### Response
```typescript
{
  id: string;
  content: string;
  role: 'assistant' | 'user';
  created_at: string;
  conversation_id: string;
}
```

### GET /api/ai/chat/conversations
Retrieves all AI chat conversations for the current user.

#### Response
```typescript
{
  conversations: {
    id: string;
    title: string;
    created_at: string;
    last_message_at: string;
    workspace_id: string;
  }[];
}
```

### DELETE /api/ai/chat/conversation
Deletes an AI chat conversation and all associated messages.

#### Request
```typescript
{
  conversationId: string;
}
```

## Edge Functions

### POST /functions/v1/chat-completion
Handles AI message processing and response generation.

#### Request Headers
```typescript
{
  Authorization: string; // JWT token
  Content-Type: 'application/json';
}
```

#### Request Body
```typescript
{
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
    name?: string;
  }[];
  workspace_id: string;
  conversation_id: string;
}
```

#### Response
```typescript
{
  response: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  context_used: boolean;
}
```

## Database Functions

### match_messages
Performs similarity search on message embeddings.

#### Parameters
```sql
query_embedding vector,
match_threshold float8,
match_count int
```

#### Returns
```sql
table (
  id uuid,
  content text,
  similarity float8
)
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```typescript
{
  error: string;
  details?: any;
}
```

### 401 Unauthorized
```typescript
{
  error: 'Unauthorized';
}
```

### 500 Internal Server Error
```typescript
{
  error: string;
  details?: any;
}
```

## Rate Limiting

- AI chat endpoints: 50 requests per minute per user
- Edge functions: 100 requests per minute per workspace
- Database functions: 1000 requests per minute per workspace

## Authentication

All endpoints require authentication using a JWT token in the Authorization header:

```typescript
headers: {
  Authorization: `Bearer ${jwt_token}`
}
```

## Websocket Subscriptions

### AI Chat Messages
```typescript
supabase
  .channel('ai_chat_messages')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'ai_assistant_messages',
    filter: `conversation_id=eq.${conversationId}`
  })
  .subscribe()
```

## Response Formats

### Success Response Format
```typescript
{
  data: T; // Response data
  metadata?: {
    processing_time: number;
    tokens_used?: number;
  };
}
```

### Error Response Format
```typescript
{
  error: {
    message: string;
    code: string;
    details?: any;
  };
} 