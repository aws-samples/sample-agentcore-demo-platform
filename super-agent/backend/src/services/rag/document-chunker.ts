/**
 * Document Chunker
 *
 * Splits text into overlapping chunks at paragraph/sentence boundaries.
 * Default: ~2000 chars per chunk, 200 chars overlap.
 */

export interface Chunk {
  index: number;
  content: string;
  startChar: number;
  endChar: number;
  tokenEstimate: number;
}

export interface ChunkerOptions {
  chunkSize?: number;   // chars, default 2000
  overlap?: number;     // chars, default 200
}

export function chunkText(text: string, options: ChunkerOptions = {}): Chunk[] {
  const chunkSize = options.chunkSize ?? 2000;
  const overlap = options.overlap ?? 200;

  if (!text || text.trim().length === 0) return [];

  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let currentStart = 0;
  let charOffset = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      charOffset += para.length + 2; // account for \n\n
      continue;
    }

    // If adding this paragraph would exceed chunk size, flush current chunk
    if (currentChunk.length > 0 && currentChunk.length + trimmed.length + 1 > chunkSize) {
      chunks.push(makeChunk(chunks.length, currentChunk, currentStart));

      // Start new chunk with overlap from end of previous
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + trimmed;
      currentStart = charOffset - overlap;
    } else {
      if (currentChunk.length === 0) {
        currentStart = charOffset;
        currentChunk = trimmed;
      } else {
        currentChunk += '\n\n' + trimmed;
      }
    }

    charOffset += para.length + 2;
  }

  // Flush remaining
  if (currentChunk.trim().length > 0) {
    chunks.push(makeChunk(chunks.length, currentChunk, currentStart));
  }

  // Handle case where a single paragraph is very long — split by sentences
  return chunks.flatMap(chunk => {
    if (chunk.content.length <= chunkSize * 1.5) return [chunk];
    return splitLongChunk(chunk, chunkSize, overlap);
  });
}

function makeChunk(index: number, content: string, startChar: number): Chunk {
  return {
    index,
    content: content.trim(),
    startChar: Math.max(0, startChar),
    endChar: startChar + content.length,
    tokenEstimate: Math.ceil(content.length / 4), // rough estimate
  };
}

function splitLongChunk(chunk: Chunk, chunkSize: number, overlap: number): Chunk[] {
  const text = chunk.content;
  const sentences = text.split(/(?<=[.!?。！？])\s+/);
  const result: Chunk[] = [];
  let current = '';
  let baseIndex = chunk.index;

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > chunkSize && current.length > 0) {
      result.push(makeChunk(baseIndex++, current, chunk.startChar));
      current = current.slice(-overlap) + ' ' + sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }

  if (current.trim()) {
    result.push(makeChunk(baseIndex, current, chunk.startChar));
  }

  // Re-index
  return result.map((c, i) => ({ ...c, index: chunk.index + i }));
}
