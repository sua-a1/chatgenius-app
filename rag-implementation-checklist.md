# ChatGenius RAG Implementation Checklist

## 1. Supabase Vector Setup
- [x] Enable pgvector extension in Supabase project
- [x] Create new tables:
  ```sql
  - message_embeddings (
    id uuid primary key,
    message_id uuid references messages(id),
    embedding vector(1536),
    metadata jsonb,
    workspace_id uuid references workspaces(id),
    channel_id uuid references channels(id),
    created_at timestamptz default now()
  )
  ```
- [x] Set up RLS policies:
  - [x] Read access based on workspace membership
  - [x] Write access for system processes only
- [x] Create necessary indexes:
  - [x] Vector similarity search index (HNSW or IVFFlat)
  - [x] Metadata filtering indexes

## 2. Environment Setup
- [x] Add new environment variables:
  ```
  # OpenAI Configuration
  OPENAI_API_KEY=your-api-key-here        # ✓ Set in Supabase Edge Functions

  # Model Configuration
  EMBEDDING_MODEL=text-embedding-ada-002   # ✓ Verified: 1536 dimensions
  EMBEDDING_DIMENSION=1536                 # ✓ Matches model output
  GPT_MODEL=gpt-3.5-turbo                 # ✓ Good for MVP, can upgrade to gpt-4
  GPT_MODEL_MAX_TOKENS=4096               # ✓ Maximum context window

  # Batch Processing
  MAX_EMBEDDING_BATCH_SIZE=100            # ✓ Optimal for performance
  MAX_CONCURRENT_REQUESTS=5               # ✓ Rate limiting
  ```
- [ ] Install dependencies:
  ```json
  {
    "@supabase/supabase-js": "latest",
    "openai": "latest",
    "pgvector": "latest"
  }
  ```

## 3. Message Processing Pipeline
- [x] Create Supabase Edge Function for embedding generation:
  - [x] Implement batched processing
  - [x] Add workspace/channel context
  - [x] Set up error handling and retries
- [x] Implement message preprocessing:
  - [x] Clean and format message content
  - [x] Handle code blocks and special formatting
  - [x] Implement chunking for long messages

## 4. Initial Data Population
- [x] Create migration script:
  - [x] Query existing messages from Supabase
  - [x] Generate embeddings in batches
  - [x] Store in message_embeddings table
  - [x] Add progress tracking
- [x ] Set up database trigger for new messages:
  - [x] Automatic embedding generation
  - [x] Error handling and retry logic

## 5. AI Chat Assistant Implementation
- [x] Create new database tables:
  ```sql
  - ai_assistant_conversations (
    id uuid primary key,
    workspace_id uuid references workspaces(id),
    user_id uuid references auth.users(id),
    created_at timestamptz default now()
  )
  - ai_assistant_messages (
    id uuid primary key,
    conversation_id uuid references ai_assistant_conversations(id),
    role text check (role in ('user', 'assistant')),
    content text,
    created_at timestamptz default now()
  )
  ```
- [x] Set up RLS policies:
  - [x] Read/write access based on workspace membership
  - [x] Conversation history visibility rules

## 6. Query & Response Pipeline
- [x ] Implement semantic search:
  ```typescript
  - [x] Create similarity search function using pgvector
  - [x] Filter by workspace context
  - [x] Sort and rank results by relevance
  - [x] Implement sliding window for conversation history
  ```
- [x] Design prompt engineering:
  - [x] Create base system prompt template
  - [x] Format retrieved context snippets
  - [x] Include conversation history
  - [x] Handle workspace-specific context
- [x] Implement response generation:
  - [x] OpenAI chat completion integration
  - [x] Error handling and retry logic
  - [x] Response streaming support
  - [x] Rate limiting and token management

## 7. API & Backend Routes
- [x] Create new API endpoints:
  - [x] `POST /api/ai/chat/start` - Start new conversation
  - [x] `POST /api/ai/chat/message` - Send message and get response
  - [x] `GET /api/ai/chat/history` - Get conversation history
  - [x] `DELETE /api/ai/chat/:id` - End/delete conversation
- [x] Implement middleware:
  - [x] Authentication check
  - [x] Workspace context validation
  - [x] Rate limiting per user/workspace
  - [x] Error handling

## 8. Frontend Integration
- [x] Create new components:
  - [x] `AIChatWindow` - Main chat interface
  - [x] `AIMessageBubble` - Message display
  - [x] `AITypingIndicator` - Loading state
  - [x] `AIConversationList` - History view
- [ ] Add state management:
  - [ ] Conversation tracking:
    ```typescript
    - [ ] Implement conversation persistence service
    - [ ] Add conversation metadata (title, last message, timestamp)
    - [ ] Handle conversation lifecycle (create, update, delete)
    - [ ] Add workspace-specific conversation filtering
    ```
  - [ ] Message history:
    ```typescript
    - [ ] Implement message history loading on conversation open
    - [ ] Add pagination for long conversations
    - [ ] Implement message deletion (single and bulk)
    - [ ] Add message status tracking (sent, delivered, error)
    ```
  - [ ] Loading states:
    ```typescript
    - [ ] Add loading indicators for history fetch
    - [ ] Handle message sending states
    - [ ] Show error states with retry options
    ```
  - [ ] Error handling:
    ```typescript
    - [ ] Implement error boundaries
    - [ ] Add retry mechanisms for failed operations
    - [ ] Show user-friendly error messages
    ```
  - [ ] Persistence:
    ```typescript
    - [ ] Store conversations in Supabase
    - [ ] Implement conversation cleanup policies
    - [ ] Add conversation export functionality
    ```
  - [ ] UI/UX enhancements:
    ```typescript
    - [ ] Add conversation list sidebar
    - [ ] Implement conversation search
    - [ ] Add conversation delete confirmation
    - [ ] Show conversation metadata (created, updated dates)
    ```

## 9. Testing
- [ ] Unit tests:
  - [ ] Embedding generation
  - [ ] Vector search accuracy
  - [ ] RLS policy validation
- [ ] Integration tests:
  - [ ] End-to-end query flow
  - [ ] Workspace isolation
  - [ ] Error scenarios

## 10. Monitoring
- [ ] Set up Supabase monitoring:
  - [ ] Query performance metrics
  - [ ] Edge function logs
  - [ ] Error tracking
- [ ] Add usage analytics:
  - [ ] Queries per workspace
  - [ ] Response times
  - [ ] Error rates

## 11. Documentation
- [ ] Technical documentation:
  - [ ] Vector setup guide
  - [ ] API endpoints
  - [ ] Database schema
- [ ] User documentation:
  - [ ] AI feature usage guide
  - [ ] Query best practices

## 12. Security Review
- [ ] Audit RLS policies
- [ ] Review API key handling
- [ ] Test workspace isolation
- [ ] Validate rate limiting 

## 13. Enhanced Prompting & Context Management
- [x] Dynamic Instruction Selection
  ```typescript
  - [x] Create instruction sets module:
    - Base system prompts for different query types
    - Contextual instructions for workspace/channel/user queries
    - Format instructions for different response types
    - Error handling instructions
  ```
  - [x] Implement instruction selection logic:
    ```typescript
    - [x] Query type classifier
    - [x] Context-aware instruction composer
    - [x] Instruction templating system
    ```

- [x] Pre-processing Logic
  ```typescript
  - [x] Message analyzer service:
    - Query type detection (workspace/channel/user/general)
    - Entity extraction (usernames, channels, dates)
    - Intent classification
    - Contextual requirements detection
  ```
  - [x] Query enhancement pipeline:
    ```typescript
    - [x] Query reformulation for better semantic search
    - [x] Context window optimization
    - [x] Entity resolution and validation
    ```

- [x] Contextual Relevance Filtering
  ```typescript
  - [x] Enhanced vector search:
    - Implement tiered retrieval strategy
    - Add metadata filtering
    - Add recency bias for time-sensitive queries
  ```
  - [x] Context assembly pipeline:
    ```typescript
    - [x] Relevance scoring system
    - [x] Context deduplication
    - [x] Context ordering by relevance
    - [x] Dynamic context window sizing
    ```

- [x] Prompt Engineering Improvements
  ```typescript
  - [x] Base system prompt enhancements:
    - Clear role and capability definition
    - Explicit formatting instructions
    - Error handling guidance
  ```
  - [x] Response enhancements:
    ```typescript
    - [x] Channel-specific 
    - [x] User-specific 
    - [x] Error message 
    - [x] General assistance 
    ```

## 14. Implementation Plan
1. Phase 1: Query Analysis & Classification
   - [x] Implement message analyzer service
   - [x] Build query type classifier
   - [x] Add entity extraction
   - [x] Test with sample queries

2. Phase 2: Instruction Management
   - [x] Create instruction sets
   - [x] Build instruction selection logic
   - [x] Implement templating system
   - [x] Test instruction composition

3. Phase 3: Context Enhancement
   - [x] Enhance vector search with metadata
   - [x] Implement tiered retrieval
   - [x] Add context scoring
   - [x] Test context relevance

4. Phase 4: Response Generation
   - [x] Update base prompts
   - [x] Add response templates
   - [x] Implement format validation
   - [x] Test end-to-end pipeline

## 15. Testing & Validation
- [ ] Create test suites:
  ```typescript
  - [ ] Query classification accuracy
  - [ ] Context relevance metrics
  - [ ] Response quality evaluation
  - [ ] End-to-end performance tests
  ```
- [ ] Implement monitoring:
  ```typescript
  - [ ] Query analysis metrics
  - [ ] Context retrieval performance
  - [ ] Response generation timing
  - [ ] Error rate tracking
  ```

## 16. Documentation Updates
- [ ] Technical documentation:
  ```typescript
  - [ ] Query analysis system
  - [ ] Instruction management
  - [ ] Context filtering
  - [ ] Response templates
  ```
- [ ] Integration guides:
  ```typescript
  - [ ] Custom instruction sets
  - [ ] Context filtering rules
  - [ ] Response format customization
  ``` 

## 17. Document-Based RAG Implementation

### Database Schema Extensions
```sql
- document_embeddings (
  id uuid primary key,
  file_id uuid references files(id),
  chunk_text text,
  embedding vector(1536),
  metadata jsonb,
  workspace_id uuid references workspaces(id),
  channel_id uuid references channels(id),
  created_at timestamptz default now()
)

- document_assistant_conversations (
  id uuid primary key,
  workspace_id uuid references workspaces(id),
  channel_id uuid references channels(id),
  user_id uuid references auth.users(id),
  file_id uuid references files(id),
  created_at timestamptz default now()
)

- document_assistant_messages (
  id uuid primary key,
  conversation_id uuid references document_assistant_conversations(id),
  role text check (role in ('user', 'assistant')),
  content text,
  created_at timestamptz default now()
)
```

### Implementation Tasks

1. File Processing Pipeline
   - [ ] Create Supabase Edge Function for document processing:
     ```typescript
     - Process files from chat_attachments bucket
     - Extract text based on file type (PDF, DOCX, TXT)
     - Implement chunking strategy for documents
     - Generate and store embeddings
     ```
   - [ ] Add file type support:
     ```typescript
     - PDF processing
     - DOCX processing
     - Plain text
     ```
   - [ ] Implement automatic processing on file upload:
     ```typescript
     - Create database trigger for new file attachments
     - Queue processing job
     - Handle failures and retries
     ```

2. UI Components
   - [ ] Channel Header Integration:
     ```typescript
     - Add "Document Assistant" button
     - Create document assistant modal/sidebar
     - Implement conversation UI
     ```
   - [ ] File Attachment Enhancement:
     ```typescript
     - Add "Ask AI" button next to attachments
     - Implement automatic summary generation
     - Show processing status indicators
     ```
   - [ ] Conversation Interface:
     ```typescript
     - Reuse AI assistant chat components
     - Add file context display
     - Show relevant document snippets
     ```

3. API Endpoints
   - [ ] Create new routes:
     ```typescript
     - POST /api/documents/process - Process new document
     - POST /api/documents/query - Query documents
     - GET /api/documents/summary/:fileId - Get file summary
     - GET /api/documents/conversations - List conversations
     - DELETE /api/documents/conversations/:id - Delete conversation
     ```

4. Document Query Pipeline
   - [ ] Implement semantic search:
     ```typescript
     - Create similarity search function
     - Filter by channel and workspace context
     - Add file metadata filtering
     - Implement relevance scoring
     ```
   - [ ] Add conversation context:
     ```typescript
     - Track conversation history
     - Include previous queries
     - Maintain file context
     ```

5. Security & Access Control
   - [ ] RLS Policies:
     ```sql
     - document_embeddings access based on channel membership
     - conversation access control
     - file access verification
     ```
   - [ ] Rate Limiting:
     ```typescript
     - Per-user query limits
     - Processing queue management
     - Storage quotas
     ```

6. Testing & Monitoring
   - [ ] Create test suite:
     ```typescript
     - File processing pipeline tests
     - Query accuracy evaluation
     - UI component tests
     - End-to-end conversation flow
     ```
   - [ ] Add monitoring:
     ```typescript
     - Processing success rates
     - Query performance metrics
     - Error tracking
     - Usage analytics
     ```

7. Documentation
   - [ ] Technical documentation:
     ```markdown
     - File processing pipeline
     - Supported file types
     - API endpoints
     - Configuration options
     ```
   - [ ] User documentation:
     ```markdown
     - How to use document assistant
     - File type support
     - Query best practices
     - Troubleshooting guide
     ``` 