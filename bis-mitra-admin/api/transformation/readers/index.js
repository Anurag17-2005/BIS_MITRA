import fs from 'fs';
import path from 'path';
import { resolveWarehouseFilePath } from '../manifest/warehouse-reader.js';
import { readJsonWarehouseItem } from './json.js';
import { readPdfBuffer } from './pdf.js';
import { readImageWarehouseItem } from './image.js';

function detectFormat(item, filePath) {
  const type = (item.type || '').toUpperCase();
  if (type === 'JSON') return 'json';
  if (type === 'IMAGE') return 'image';
  if (type === 'PDF') return 'pdf';
  const ext = path.extname(filePath || item.name || '').toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  if (item.content != null) return 'json';
  return 'unknown';
}

/**
 * Read one warehouse item into { text, rawMeta }.
 */
export async function readWarehouseItem(item) {
  const filePath = resolveWarehouseFilePath(item);
  const format = detectFormat(item, filePath);

  if (format === 'json') {
    const buffer = filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
    return readJsonWarehouseItem(item, filePath, buffer);
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      text: '',
      rawMeta: { format, missingFile: true, attemptedPath: filePath },
    };
  }

  const buffer = fs.readFileSync(filePath);

  if (format === 'pdf') {
    return readPdfBuffer(buffer, filePath);
  }

  if (format === 'image') {
    return await readImageWarehouseItem(item, filePath);
  }

  return {
    text: buffer.toString('utf8').slice(0, 500_000),
    rawMeta: { format: 'text', sourcePath: filePath },
  };
}
