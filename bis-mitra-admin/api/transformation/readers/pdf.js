import { supplementPdfText } from './pdf-ocr.js';
import {
  assessPdfTextQuality,
  sanitizeExtractedText,
} from '../techniques/normalization/indic-sanitize.js';

/**
 * Page-aware PDF text extraction for chunk → page deep links.
 */
async function extractTextWithPageMap(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let fullText = '';
  const pageMap = [];

  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const pageText = content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    const charStart = fullText.length;
    fullText += (fullText && pageText ? '\n' : '') + pageText;
    pageMap.push({ page: n, charStart, charEnd: fullText.length });
  }

  return {
    text: sanitizeExtractedText(fullText.trim()),
    pageMap,
    pageCount: pdf.numPages,
  };
}

/**
 * Extract plain text from a PDF buffer.
 */
export async function readPdfBuffer(buffer, filePath) {
  try {
    let text = '';
    let pageMap = [];
    let pageCount = 0;
    let ocrSource = null;
    let ocrPending = false;

    try {
      const mapped = await extractTextWithPageMap(buffer);
      text = mapped.text;
      pageMap = mapped.pageMap;
      pageCount = mapped.pageCount;
    } catch {
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const parsed = await pdfParse(buffer);
      const rawText = (parsed.text || '').trim();
      text = sanitizeExtractedText(rawText);
      pageCount = parsed.numpages || 0;
    }

    const rawQuality = assessPdfTextQuality(text);
    if (filePath && (text.length < 20 || rawQuality.corrupt)) {
      const extra = await supplementPdfText(filePath, text, { corrupt: rawQuality.corrupt });
      text = sanitizeExtractedText((extra.text || '').trim());
      ocrSource = extra.ocrSource;
      if (!text && !ocrSource) ocrPending = true;
    }

    return {
      text,
      rawMeta: {
        format: 'pdf',
        pageCount,
        pageMap: pageMap.length ? pageMap : null,
        sourcePath: filePath,
        ocrSource,
        ocrPending,
      },
    };
  } catch (err) {
    return {
      text: '',
      rawMeta: {
        format: 'pdf',
        sourcePath: filePath,
        extractError: err.message,
      },
    };
  }
}
