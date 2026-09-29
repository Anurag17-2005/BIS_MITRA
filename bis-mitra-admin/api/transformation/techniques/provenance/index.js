import { stampProvenance } from './stamp.js';

export function applyProvenance(item, record) {
  return stampProvenance(item, record);
}
