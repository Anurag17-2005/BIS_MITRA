import { toGoldenRecord, validateGoldenRecord } from './golden-schema.js';

export function applyStandardization(item, draft, ctx) {
  const record = toGoldenRecord(item, draft, ctx);
  const schemaWarnings = validateGoldenRecord(record);
  if (schemaWarnings.length) {
    record.quality = {
      status: record.quality?.status === 'duplicate' ? 'duplicate' : 'warning',
      warnings: [...(record.quality?.warnings || []), ...schemaWarnings],
    };
  }
  return record;
}
