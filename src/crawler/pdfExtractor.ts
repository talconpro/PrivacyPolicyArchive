import { PDFParse } from 'pdf-parse';

import { normalizeText } from '../lib/text';

/**
 * Extracts text from PDF bytes with pdf-parse.
 * Keeping this isolated makes parser replacement straightforward.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<{
  rawText: string;
  normalizedText: string;
  parserUsed: 'pdf-parse';
}> {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const parsed = await parser.getText();
    const rawText = (parsed.text ?? '').trim();

    return {
      rawText,
      normalizedText: normalizeText(rawText),
      parserUsed: 'pdf-parse',
    };
  } finally {
    await parser.destroy();
  }
}
