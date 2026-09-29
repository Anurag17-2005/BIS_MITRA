/**
 * Mutating actions stay on the confirmation path.
 * The model may suggest a next step; it cannot submit, delete, or change status.
 */

/** Tools with side effects in eBIS / enforcement systems → human-readable effect (single source of truth). */
export const WRITE_TOOLS = {
  submit_portal_form: 'submit an application or grievance on the BIS portal',
  trigger_hazard_alert: 'log a public safety hazard report and alert BIS inspectors',
  report_hallmark_violation: 'file a hallmarking violation complaint against the jeweller',
  log_test_certificate: 'log this test certificate in the central laboratory registry',
  initialize_cross_testing: 'start a blind inter-laboratory proficiency testing round',
  log_raid_evidence: 'record a timestamped enforcement evidence entry',
  execute_emergency_seal: 'issue an emergency factory sealing order',
};

export const MUTATING_TOOLS = new Set(Object.keys(WRITE_TOOLS));

const ACTION_CLAIM_RE = /\b(?:i have (?:successfully )?(?:filed|submitted|dispatched|deleted|cancelled)|application submitted|complaint ticket id|status (?:has been|was) (?:changed|updated to)|i (?:deleted|removed) (?:the|your))\b/i;

export function isMutatingTool(toolName) {
  return MUTATING_TOOLS.has(toolName);
}

/**
 * Block model-originated mutations. User confirmation must set invokedBy to "user".
 * Returns a structured refusal, or null when the call may proceed.
 */
export function refuseUnconfirmedAction(toolName, args = {}) {
  if (!isMutatingTool(toolName)) return null;
  const fromModel = args.invokedBy === 'llm' || args.source === 'llm' || args._fromModel === true;
  if (fromModel || !args.confirm) {
    return {
      ok: false,
      blocked: true,
      awaiting_confirmation: !args.confirm,
      error: fromModel
        ? 'The model cannot submit, delete, or change status. A confirmed user action is required.'
        : 'Confirmation is required before this action.',
    };
  }
  return null;
}

/**
 * Remove sentences where the model claims it already performed an action.
 * Returns null when nothing user-safe remains.
 */
export function stripUnconfirmedActionClaims(text) {
  const src = String(text || '');
  if (!ACTION_CLAIM_RE.test(src)) return src;
  const chunks = src.split(/\n+/);
  const kept = [];
  for (const chunk of chunks) {
    const sentences = chunk.split(/(?<=[.!?])\s+/);
    const ok = sentences.filter((s) => !ACTION_CLAIM_RE.test(s));
    if (ok.length) kept.push(ok.join(' '));
  }
  const out = kept.join('\n\n').trim();
  return out || null;
}
