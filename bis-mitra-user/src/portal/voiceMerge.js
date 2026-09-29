/** Client-side transcript merge (mirrors server normalize merge). */
export function mergeTranscriptParts(existing, addition, { interim = false } = {}) {
  const base = String(existing || '').trim();
  const add = String(addition || '').trim();
  if (!add) return base;
  if (!base) return add;
  if (interim) return `${base} ${add}`.trim();
  if (base.endsWith(add) || base.includes(add)) return base;
  return `${base} ${add}`.trim();
}
