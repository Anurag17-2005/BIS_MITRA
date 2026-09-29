/**
 * Read inline or file-based JSON warehouse items into plain text for golden layer.
 */
export function readJsonWarehouseItem(item, filePath, fileBuffer) {
  let data = item.content;
  if (data == null && fileBuffer) {
    data = JSON.parse(fileBuffer.toString('utf8'));
  }
  if (data == null) {
    return { text: '', rawMeta: { format: 'json', empty: true } };
  }

  const lines = [];
  if (Array.isArray(data)) {
    for (const row of data) {
      lines.push(flattenObject(row));
    }
  } else if (data.standards) {
    for (const s of data.standards) {
      lines.push(`${s.is_number || ''} — ${s.title || ''} (${s.mandatory_voluntary || s.status || ''})`);
    }
  } else if (data.items) {
    for (const n of data.items) {
      lines.push(`${n.title || ''}: ${n.summary || ''}`);
    }
  } else if (data.fees) {
    for (const f of data.fees) {
      lines.push(`${f.is_number || ''} — ${f.title || ''}: ${f.fee_amount || ''}`);
    }
  } else if (data.documents) {
    for (const d of data.documents) {
      lines.push(`${d.title || d.name || ''} (${d.scheme || ''})`);
    }
  } else if (data.manuals) {
    for (const m of data.manuals) {
      lines.push(`${m.is_number || ''} — ${m.title || ''}`);
    }
  } else {
    lines.push(JSON.stringify(data, null, 2));
  }

  return {
    text: lines.filter(Boolean).join('\n'),
    rawMeta: { format: 'json', structured: true, sourcePath: filePath || null },
  };
}

function flattenObject(obj) {
  if (!obj || typeof obj !== 'object') return String(obj);
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
}
