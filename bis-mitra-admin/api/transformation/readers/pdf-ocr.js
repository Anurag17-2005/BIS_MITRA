import fs from 'fs';
import {
  assessPdfTextQuality,
  pickCleanerText,
  sanitizeExtractedText,
} from '../techniques/normalization/indic-sanitize.js';

const MIN_OCR_CHARS = 8;
const DEFAULT_MAX_PAGES = Number(process.env.PDF_OCR_MAX_PAGES || 12);

function readSidecarText(filePath) {
  if (!filePath) return null;
  const candidates = [
    `${filePath}.txt`,
    `${filePath}.ocr.txt`,
    filePath.replace(/\.pdf$/i, '.txt'),
    filePath.replace(/\.pdf$/i, '.ocr.txt'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const t = fs.readFileSync(p, 'utf8').trim();
      if (t.length >= MIN_OCR_CHARS) return t;
    }
  }
  return null;
}

async function ocrPdfPages(filePath, maxPages = DEFAULT_MAX_PAGES) {
  if (process.env.OCR_ENABLED === '0') return null;
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');
    const { createWorker } = await import('tesseract.js');

    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await getDocument({ data, useSystemFonts: true }).promise;
    const pageLimit = Math.min(pdf.numPages, maxPages);
    const lang = process.env.OCR_LANG || 'hin+eng';
    const worker = await createWorker(lang);
    const parts = [];

    for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const png = canvas.toBuffer('image/png');
      const { data: ocrData } = await worker.recognize(png);
      const text = (ocrData?.text || '').trim();
      if (text) parts.push(text);
    }

    await worker.terminate();
    const joined = parts.join('\n\n').trim();
    return joined.length >= MIN_OCR_CHARS ? joined : null;
  } catch {
    return null;
  }
}

/**
 * Supplement pdf-parse when text layer is empty or corrupt (Hindi gazettes / bad fonts).
 */
export async function supplementPdfText(filePath, existingText = '', { corrupt = false } = {}) {
  const parsed = sanitizeExtractedText(existingText);
  const quality = assessPdfTextQuality(parsed);
  const needsRepair = corrupt || quality.corrupt || parsed.length < 20;

  if (!needsRepair) {
    return { text: parsed, ocrSource: null };
  }

  const sidecar = readSidecarText(filePath);
  if (sidecar) {
    const cleanSidecar = sanitizeExtractedText(sidecar);
    const pick = pickCleanerText(parsed, cleanSidecar);
    return {
      text: pick.text,
      ocrSource: pick.source === 'ocr' ? 'sidecar' : null,
    };
  }

  const ocr = await ocrPdfPages(filePath, DEFAULT_MAX_PAGES);
  if (ocr) {
    const pick = pickCleanerText(parsed, ocr);
    return {
      text: pick.text,
      ocrSource: pick.source === 'ocr' ? 'tesseract-pdf' : null,
    };
  }

  return { text: parsed, ocrSource: null };
}
