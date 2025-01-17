import { serve } from './deps.ts';
import { OpenAI, corsHeaders, createSupabaseClient, PDFParser, mammoth } from './deps.ts';
import { CHUNK_SIZE, CHUNK_OVERLAP, EMBEDDING_MODEL, SUPPORTED_FILE_TYPES } from './config.ts';
import type { ProcessDocumentPayload, FileMetadata, DocumentChunk, ProcessingResult } from './types.ts';

console.log('Loading process-document function...');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

// Function to chunk text with overlap
function chunkText(text: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;

  while (currentIndex < text.length) {
    // Get chunk with overlap
    const chunkText = text.slice(
      currentIndex,
      Math.min(currentIndex + CHUNK_SIZE, text.length)
    );

    // Add chunk to array
    chunks.push({
      text: chunkText,
      metadata: {
        chunk_size: CHUNK_SIZE,
        chunk_overlap: CHUNK_OVERLAP,
        chunk_index: chunkIndex,
        total_chunks: Math.ceil(text.length / (CHUNK_SIZE - CHUNK_OVERLAP)),
        filename: '', // Will be set later
        file_type: '' // Will be set later
      }
    });

    // Move index forward by chunk size minus overlap
    currentIndex += CHUNK_SIZE - CHUNK_OVERLAP;
    chunkIndex++;

    // If we're near the end, don't create another overlapping chunk
    if (currentIndex + CHUNK_SIZE - CHUNK_OVERLAP >= text.length) {
      break;
    }
  }

  return chunks;
}

// Function to extract text from PDF
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        // Extract text from each page
        const pages = pdfData.formImage.Pages || [];
        const text = pages.map((page: any) => {
          const texts = page.Texts || [];
          return texts
            .map((text: any) => decodeURIComponent(text.R[0].T))
            .join(' ');
        }).join('\n\n');

        resolve(text);
      } catch (error) {
        reject(new Error('Failed to parse PDF content: ' + error.message));
      }
    });

    pdfParser.on('pdfParser_dataError', (error: Error) => {
      reject(new Error('Failed to parse PDF: ' + error.message));
    });

    try {
      // Convert ArrayBuffer to Buffer for pdf2json
      const buffer8 = new Uint8Array(buffer);
      pdfParser.parseBuffer(buffer8);
    } catch (error) {
      reject(new Error('Failed to process PDF buffer: ' + error.message));
    }
  });
}

// Function to extract text from DOCX
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  } catch (error) {
    throw new Error('Failed to extract text from DOCX: ' + error.message);
  }
}

// Function to extract text from file based on type
async function extractText(fileUrl: string, fileType: string): Promise<string> {
  try {
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();

    switch (fileType) {
      case SUPPORTED_FILE_TYPES.TEXT:
        return new TextDecoder().decode(buffer);
      
      case SUPPORTED_FILE_TYPES.PDF:
        return await extractPdfText(buffer);
      
      case SUPPORTED_FILE_TYPES.DOCX:
      case SUPPORTED_FILE_TYPES.DOC:
        return await extractDocxText(buffer);
      
      case SUPPORTED_FILE_TYPES.PNG:
      case SUPPORTED_FILE_TYPES.JPEG:
      case SUPPORTED_FILE_TYPES.JPG:
        // For now, we'll store image files without text extraction
        // TODO: Implement OCR for images later
        return `[Image File: ${fileType}] - Text extraction not yet supported for images`;
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

async function processDocument(payload: ProcessDocumentPayload): Promise<ProcessingResult> {
  const { fileId, workspaceId, channelId, userId } = payload;
  const supabase = createSupabaseClient(userId);

  // Get file information
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*, users!files_user_id_fkey(id)')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    throw new Error('File not found');
  }

  // Extract text from file
  const text = await extractText(file.file_url, file.file_type);
  if (!text) {
    throw new Error('Could not extract text from file');
  }

  // Generate embedding for the entire document
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });

  const [{ embedding }] = embeddingResponse.data;

  // Store in document_embeddings
  const { error: insertError } = await supabase
    .from('document_embeddings')
    .insert({
      file_id: fileId,
      version: 1,
      is_latest: true,
      original_document_content: text,
      channel_id: channelId,
      user_id: file.user_id,
      workspace_id: workspaceId,
      metadata: {
        filename: file.filename,
        file_type: file.file_type,
        file_size: file.file_size,
        file_url: file.file_url,
        updated_at: new Date().toISOString()
      },
      embedding
    });

  if (insertError) {
    console.error('Error inserting document embedding:', insertError);
    throw insertError;
  }

  // Update status in pending_document_embeddings
  const { error: updateError } = await supabase
    .from('pending_document_embeddings')
    .update({ 
      status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('file_id', fileId);

  if (updateError) {
    console.error('Error updating pending status:', updateError);
    throw updateError;
  }

  return { 
    success: true, 
    file_id: fileId
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: ProcessDocumentPayload = await req.json();
    const result = await processDocument(payload);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}); 