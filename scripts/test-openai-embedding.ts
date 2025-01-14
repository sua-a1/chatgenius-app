import OpenAI from 'openai'
import 'dotenv/config'

async function testEmbedding() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const testMessage = 'Test message for embedding'

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: testMessage,
    })

    console.log('Successfully generated embedding:')
    console.log('Input text:', testMessage)
    console.log('Embedding dimension:', embeddingResponse.data[0].embedding.length)
    console.log('First few values:', embeddingResponse.data[0].embedding.slice(0, 5))
  } catch (error) {
    console.error('Error generating embedding:', error)
  }
}

testEmbedding().catch(console.error) 