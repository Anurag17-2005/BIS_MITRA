/** Section tags — mirrors bis-mitra-admin/api/sections.js */
export const SECTION_TAGS = {
  news: 'chunk:news',
  fees: 'chunk:fees',
  manuals: 'chunk:manuals',
  standards: 'chunk:standards',
  process: 'chunk:process',
  schemes: 'chunk:schemes',
  hallmarking: 'chunk:hallmarking',
  labs: 'chunk:labs',
  consumer: 'chunk:consumer',
};

export function sectionTag(sectionId) {
  return SECTION_TAGS[sectionId] || `chunk:${sectionId || 'unknown'}`;
}
