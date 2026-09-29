/** Human-readable mode labels for the intelligent input indicator (not user-selectable). */
export const MODE_LABELS = {
  verification: 'Verification',
  knowledge: 'Knowledge',
  workflow: 'Guidance',
  status: 'Status',
  calculation: 'Calculation',
  alert: 'Alert',
  comparison: 'Comparison',
  document: 'Document',
  analysis: 'Analysis',
  chat: 'General',
};

export function modeLabelFromIntent(intent) {
  const map = {
    greeting: 'General',
    about: 'General',
    knowledge: 'Knowledge',
    validation: 'Verification',
    status: 'Status',
    verification: 'Verification',
    eligibility: 'Guidance',
    calculation: 'Calculation',
    comparison: 'Comparison',
    alert: 'Alert',
    task: 'Guidance',
    workflow_status: 'Status',
    document: 'Document',
    translation: 'Knowledge',
    analysis: 'Analysis',
  };
  return map[intent] || 'Knowledge';
}

export function modeLabel(uiMode, intent) {
  if (intent === 'workflow_status' || intent === 'status') return 'Status';
  if (uiMode && MODE_LABELS[uiMode]) return MODE_LABELS[uiMode];
  return modeLabelFromIntent(intent);
}
