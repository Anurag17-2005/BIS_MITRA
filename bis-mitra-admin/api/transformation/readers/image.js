/**
 * Images → text for golden layer.
 * Priority: meta.ocrText → sidecar .txt / .ocr.txt → optional tesseract.js → filename heuristics.
 */
import fs from 'fs';
import path from 'path';

async function tryTesseract(filePath) {
  if (process.env.OCR_ENABLED === '0') return null;
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(process.env.OCR_LANG || 'hin+eng');
    const { data } = await worker.recognize(filePath);
    await worker.terminate();
    const text = (data?.text || '').trim();
    return text.length >= 8 ? text : null;
  } catch {
    return null;
  }
}

function readSidecarText(filePath) {
  if (!filePath) return null;
  const candidates = [
    `${filePath}.txt`,
    `${filePath}.ocr.txt`,
    filePath.replace(/\.(png|jpe?g|webp|gif)$/i, '.txt'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const t = fs.readFileSync(p, 'utf8').trim();
      if (t) return t;
    }
  }
  return null;
}

function heuristicFromName(item, filePath) {
  const name = item.name || path.basename(filePath || '') || 'image';
  const title = item.meta?.title || name;
  const isMatch = String(title + ' ' + name).match(/IS\s*[\d.:]+/i);
  const bits = [`[Image document: ${title}]`];
  if (isMatch) bits.push(`Related standard: ${isMatch[0]}`);
  if (item.meta?.description) bits.push(item.meta.description);
  if (item.meta?.keywords) bits.push(`Keywords: ${item.meta.keywords}`);
  return bits.join('\n');
}

/**
 * Read image warehouse item into { text, rawMeta }.
 */
export async function readImageWarehouseItem(item, filePath) {
  const name = item.name || filePath?.split('/').pop() || 'image';
  const title = item.meta?.title || name;

  if (item.meta?.ocrText && String(item.meta.ocrText).trim()) {
    return {
      text: String(item.meta.ocrText).trim(),
      rawMeta: {
        format: 'image',
        sourcePath: filePath,
        ocrPending: false,
        ocrSource: 'meta',
      },
    };
  }

  const sidecar = readSidecarText(filePath);
  if (sidecar) {
    return {
      text: sidecar,
      rawMeta: {
        format: 'image',
        sourcePath: filePath,
        ocrPending: false,
        ocrSource: 'sidecar',
      },
    };
  }

  if (filePath && fs.existsSync(filePath) && process.env.OCR_ENABLED !== '0') {
    const ocr = await tryTesseract(filePath);
    if (ocr) {
      return {
        text: ocr,
        rawMeta: {
          format: 'image',
          sourcePath: filePath,
          ocrPending: false,
          ocrSource: 'tesseract',
        },
      };
    }
  }

  return {
    text: heuristicFromName(item, filePath),
    rawMeta: {
      format: 'image',
      sourcePath: filePath,
      ocrPending: true,
      ocrSource: 'heuristic',
      title,
    },
  };
}
