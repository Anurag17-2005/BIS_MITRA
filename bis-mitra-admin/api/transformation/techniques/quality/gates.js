const MIN_TEXT_LEN = 20;

export function applyQualityGates(draft, item) {
  const warnings = [...(draft.quality?.warnings || [])];
  let status = draft.quality?.status || 'ok';

  if (draft.rawMeta?.missingFile) {
    status = 'failed';
    warnings.push('source file not found');
  }
  if (draft.rawMeta?.extractError) {
    status = 'failed';
    warnings.push(`pdf extract failed: ${draft.rawMeta.extractError}`);
  }
  if (draft.rawMeta?.ocrPending) {
    warnings.push('ocr pending for image');
    if (status === 'ok') status = 'warning';
  }

  const textLen = (draft.text || '').trim().length;
  if (textLen === 0 && item.type !== 'JSON') {
    status = 'failed';
    warnings.push('no extractable text');
  } else if (textLen > 0 && textLen < MIN_TEXT_LEN && !draft.rawMeta?.ocrPending) {
    warnings.push('very short text');
    if (status === 'ok') status = 'warning';
  }

  return {
    ...draft,
    quality: { status, warnings },
  };
}
