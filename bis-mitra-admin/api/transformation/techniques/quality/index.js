import { applyQualityGates } from './gates.js';

export function applyQuality(item, draft) {
  return applyQualityGates(draft, item);
}
