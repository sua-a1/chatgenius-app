# Vector Setup Guide

## Overview
ChatGenius uses a vector-based retrieval system for enhanced AI responses. This guide explains how to set up and configure the vector storage system.

## Components

### 1. Database Configuration
- Supabase PostgreSQL with pgvector extension
- Vector dimensions: 1536 (OpenAI embeddings)
- Cosine similarity for vector matching

### 2. Tables Structure
```sql
-- Vector storage for message embeddings
create table message_embeddings (
  id uuid primary key,
  message_id uuid references messages(id) on delete cascade,
  embedding vector(1536),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create GiST index for faster similarity search
create index on message_embeddings using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

### 3. Edge Function Setup
The chat-completion Edge Function handles vector operations:
- Message embedding generation
- Similarity search
- Context assembly

## Configuration

### 1. Environment Variables
```bash
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Edge Function Configuration
```toml
# supabase/functions/chat-completion/config.toml
[functions.chat-completion]
verify_jwt = true
```

## Implementation Details

### 1. Message Processing
- Messages are automatically embedded using OpenAI's text-embedding-ada-002 model
- Embeddings are stored in the message_embeddings table
- Each message maintains a reference to its original content

### 2. Retrieval Process
- Cosine similarity search for finding relevant context
- Configurable similarity threshold (default: 0.8)
- Results limited to most recent and relevant messages

### 3. Performance Optimization
- Batch processing for multiple embeddings
- Caching of frequently accessed embeddings
- Automatic cleanup of outdated embeddings

## Usage Example

```typescript
// Example of manual embedding generation
async function generateEmbedding(text: string) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text
  });
  return embedding.data[0].embedding;
}

// Example of similarity search
async function findSimilarMessages(embedding: number[]) {
  const { data } = await supabase.rpc('match_messages', {
    query_embedding: embedding,
    match_threshold: 0.8,
    match_count: 10
  });
  return data;
}
```

## Maintenance

### 1. Regular Tasks
- Monitor embedding table size
- Clean up orphaned embeddings
- Update similarity thresholds based on usage

### 2. Performance Monitoring
- Track query response times
- Monitor embedding generation latency
- Adjust index parameters as needed

## Troubleshooting

### Common Issues
1. Slow similarity searches
   - Check index effectiveness
   - Adjust match threshold
   - Optimize query parameters

2. Missing embeddings
   - Verify trigger functions
   - Check error logs
   - Validate message processing pipeline

3. High memory usage
   - Monitor vector table size
   - Implement cleanup routines
   - Adjust batch processing size 