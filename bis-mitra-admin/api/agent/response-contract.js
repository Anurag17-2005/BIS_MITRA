/**
 * Structured answer contract. The UI still receives rendered markdown in `answer`.
 * suggested_cta is advisory metadata and is never executed.
 */

export const RESPONSE_CONTRACT_INSTRUCTION = `RESPONSE FORMAT:
Return one JSON object and no other text. Use only facts from CONTEXT, ENFORCEMENT, and LIVE REGISTRY.
Schema:
{
  "summary": "short answer",
  "sections": [{"heading": "string", "body": "string"}],
  "bullets": ["string"],
  "steps": ["string"],
  "claims": [{"text": "string", "evidence_ids": ["E1"]}],
  "missing_data": ["what is not in the sources"],
  "suggested_cta": {"label": "string", "prompt": "string"} or null,
  "workflow_state": {"intent": "string", "status": "string", "requires_confirmation": true} or null
}
Rules:
- evidence_ids must refer to passage ids such as E1 that appear in the user message.
- suggested_cta only suggests a next step. You cannot submit, delete, or change a status.
- If the sources do not support a product or IS number, put that in missing_data and do not invent it.
- workflow_state.requires_confirmation is true whenever a filing or application is not yet confirmed by the user.`;

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

export function normalizeContract(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const summary = String(raw.summary || raw.answer || '').trim();
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((s) => ({
      heading: String(s?.heading || s?.title || '').trim(),
      body: String(s?.body || s?.text || '').trim(),
    })).filter((s) => s.heading || s.body)
    : [];
  const claims = Array.isArray(raw.claims)
    ? raw.claims.map((c) => ({
      text: String(c?.text || '').trim(),
      evidence_ids: asStringList(c?.evidence_ids || c?.evidenceIds),
    })).filter((c) => c.text)
    : [];
  const cta = raw.suggested_cta || raw.suggestedCta;
  const suggested_cta = cta && typeof cta === 'object' && (cta.label || cta.prompt)
    ? { label: String(cta.label || '').trim(), prompt: String(cta.prompt || cta.action || '').trim() }
    : null;
  const wf = raw.workflow_state || raw.workflowState;
  const workflow_state = wf && typeof wf === 'object'
    ? {
      intent: String(wf.intent || '').trim() || null,
      status: String(wf.status || '').trim() || null,
      requires_confirmation: wf.requires_confirmation !== false && wf.requiresConfirmation !== false,
    }
    : null;

  if (!summary && !sections.length && !claims.length) return null;
  return {
    summary,
    sections,
    bullets: asStringList(raw.bullets || raw.points),
    steps: asStringList(raw.steps),
    claims,
    missing_data: asStringList(raw.missing_data || raw.missingData),
    suggested_cta,
    workflow_state,
  };
}

export function parseModelContent(raw) {
  const text = String(raw || '').trim();
  if (!text) return { contract: null, prose: null };
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  if (candidate.startsWith('{') || candidate.startsWith('[')) {
    try {
      const parsed = JSON.parse(candidate);
      const contract = normalizeContract(parsed);
      if (contract) return { contract, prose: null };
      return { contract: null, prose: null, invalid: true };
    } catch {
      return { contract: null, prose: null, invalid: true };
    }
  }
  return {
    contract: normalizeContract({ summary: text }),
    prose: text,
  };
}

/** Deterministic markdown for the existing chat `answer` field. */
export function renderContractMarkdown(contract) {
  if (!contract) return '';
  const lines = [];
  if (contract.summary) lines.push(contract.summary);
  for (const section of contract.sections || []) {
    if (section.heading) lines.push('', `## ${section.heading}`);
    if (section.body) lines.push(section.body);
  }
  if (contract.bullets?.length) {
    lines.push('');
    for (const bullet of contract.bullets) lines.push(`- ${bullet}`);
  }
  if (contract.steps?.length) {
    lines.push('');
    contract.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }
  const hasBody = contract.sections?.length || contract.bullets?.length || contract.steps?.length;
  if (!hasBody && contract.claims?.length) {
    const summaryKey = String(contract.summary || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const extra = contract.claims
      .map((c) => c.text)
      .filter((t) => !summaryKey.includes(t.toLowerCase().replace(/[^a-z0-9]+/g, '')));
    if (extra.length) {
      lines.push('');
      for (const t of extra) lines.push(`- ${t}`);
    }
  }
  if (contract.missing_data?.length) {
    lines.push('', `**Not in the current data:** ${contract.missing_data.join('; ')}`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
