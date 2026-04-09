/**
 * Document Text Extractor
 *
 * Extracts plain text from uploaded files based on mime type.
 * Supports: plain text, markdown, PDF, DOCX.
 */

import { readFile } from 'fs/promises';

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv') {
    return readFile(filePath, 'utf-8');
  }

  if (mimeType === 'application/pdf') {
    return extractPdf(filePath);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractDocx(filePath);
  }

  // Fallback: try reading as UTF-8 text
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

async function extractPdf(filePath: string): Promise<string> {
  // Dynamic import to avoid hard dependency if pdf-parse is not installed
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await readFile(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  } catch (err) {
    // Fallback: try pdftotext CLI
    const { execSync } = await import('child_process');
    try {
      return execSync(`pdftotext "${filePath}" - 2>/dev/null`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    } catch {
      throw new Error(`Failed to extract PDF text: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function extractDocx(filePath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (err) {
    throw new Error(`Failed to extract DOCX text: ${err instanceof Error ? err.message : err}`);
  }
}
