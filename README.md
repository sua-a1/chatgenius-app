# ChatGenius App

A modern real-time chat application with AI assistance capabilities, built with Next.js, Supabase, and shadcn/ui.

## Features

### Core Chat Features
- Real-time messaging with optimized performance
- Thread-based conversations
- Direct messaging
- Channel management
- File attachments and previews
- Message reactions
- User presence indicators
- Role-based permissions

### AI Assistant Integration
- Contextual workspace assistance
- Real-time chat with AI
- Thread-based AI conversations
- Chat history export
- Conversation memory and context management

## Technical Implementation

### Real-time Architecture
- Optimized Supabase real-time subscriptions
- Separate message and reaction channels
- Efficient state management
- Reduced database queries
- Preserved reaction states during updates

### RAG Implementation
The AI assistant uses a Retrieval-Augmented Generation (RAG) system with the following components:

#### Query Analysis System
- Instruction management for contextual queries
- Context filtering for relevant information retrieval
- Response templates for consistent AI outputs

#### Integration Components
- Custom instruction sets for workspace-specific queries
- Context filtering rules for improved relevance
- Response format customization

## Setup and Configuration

### Prerequisites
- Node.js 18+
- Supabase account
- OpenAI API key

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### Installation
1. Clone the repository
```bash
git clone https://github.com/yourusername/chatgenius-app.git
cd chatgenius-app
```

2. Install dependencies
```bash
npm install
```

3. Run development server
```bash
npm run dev
```

## Documentation

### Technical Documentation
- Vector setup guide @docs/technical/vector-setup-guide.md
- API endpoints documentation @docs/technical/api-endpoints.md
- Database schema documentation @docs/technical/database-schema.md

### User Documentation
- AI feature usage guide @docs/user/ai-features-guide.md
- Query best practices @docs/user/query-best-practices.md

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

[License Type] - See LICENSE file for details
