// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Simple text to vector conversion using hashing
function hashText(text: string): number[] {
  const vector = new Array(1536).fill(0)
  const words = text.toLowerCase().split(/\s+/)
  
  for (const word of words) {
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i)
      hash = hash & hash
    }
    const index = Math.abs(hash) % 1536
    vector[index] = 1
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return vector.map(val => val / magnitude)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { input } = await req.json()

    if (!input) {
      return new Response(
        JSON.stringify({ error: 'Missing input text' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const embedding = hashText(input.trim())

    return new Response(
      JSON.stringify({ embedding }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )
  }
}) 