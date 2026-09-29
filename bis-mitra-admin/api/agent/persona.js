/**
 * Kid (consumer) vs Expert (industry) answer formatting.
 */

export function resolvePersonaMode(mode, query, hits = []) {
  const m = String(mode || 'auto').toLowerCase();
  if (m === 'consumer' || m === 'kid') return 'consumer';
  if (m === 'industry' || m === 'expert') return 'industry';

  // auto: prefer hit personas, else query heuristics
  const personas = hits.map(h => h.metadata?.persona_target || h.citation?.persona_target).filter(Boolean);
  if (personas.filter(p => p === 'consumer').length > personas.filter(p => p === 'industry').length) {
    return 'consumer';
  }
  if (/\b(gold\s+ring|complaint|consumer|verify\s+mark|hallmark|nakli|shudhata)\b/i.test(query)) {
    return 'consumer';
  }
  if (/\b(factory|clause|mpa|sit|sti|machinery|hydrostatic|scheme-?i|tolerance|mm\b)\b/i.test(query)) {
    return 'industry';
  }
  return personas.includes('industry') ? 'industry' : 'consumer';
}

/**
 * Deterministic Everyday Citizen playbook answers (no LLM required for demo).
 */
/** Canned playbooks may only answer questions about their own topic. */
const PLAYBOOK_TOPICS = {
  toys: /\b(toys?|khilon[ae]|IS\s*9873)\b|खिलौन/i,
  jargon: /\b(dielectric|2000\s*v|high[-\s]?voltage|insulation\s+test|jargon|technical\s+term)\b/i,
  dispute: /\b(dispute|merchant|shopkeeper|refund|leverage|legal)\b/i,
};

export function formatCitizenPlaybook(toolName, data, query = '') {
  if (!toolName || !data) return null;
  const d = data.data || data;

  if (toolName === 'search_knowledge_base') {
    if (!PLAYBOOK_TOPICS.toys.test(query)) return null;
    const rows = Array.isArray(d.catalog) ? d.catalog : (d.catalog?.results || []);
    const part3 = rows.find(r => /part\s*3|migration/i.test(r.part || r.title || '')) || rows[rows.length - 1];
    const limits = part3?.chemical_limits || part3?.migration_limits
      || 'Lead < 90 mg/kg, Cadmium < 75 mg/kg, Antimony < 60 mg/kg, Arsenic < 25 mg/kg';
    return `🧸 **Toy safety (IS 9873)** — what to check before buying:\n\n`
      + `1. **Mechanical tests (Part 1):** No sharp edges or small parts that could choke a child under 3.\n`
      + `2. **Flammability (Part 2):** Materials must be self-extinguishing.\n`
      + `3. **Chemical limits (Part 3):** Heavy-metal migration limits — ${limits}.\n\n`
      + `Only buy plastic toys with the official **ISI/BIS safety mark** under the Toys QCO.`;
  }

  if (toolName === 'submit_portal_form' && (d.ticket_id || d.tracking_id)) {
    const tid = d.ticket_id || d.tracking_id || 'CON-GRP-4401';
    return d.message || `I have successfully filled out and dispatched your safety grievance to the enforcement cell. Complaint Ticket ID: **${tid}** has been created. I will automatically track this ticket on your dashboard profile.`;
  }

  if (toolName === 'grievance_status' || (toolName === 'check_system_freshness' && d.grievance)) {
    const g = d.record || d.grievance || (d.results || [])[0];
    if (!g?.ticket_id || !g.status) return null;
    return `📋 **Complaint tracker — ${g.ticket_id}**\n\n`
      + `Status: **${g.status.replace(/_/g, ' ')}**\n`
      + (g.action ? `Action: ${g.action}\n` : '')
      + (g.officer_notes ? `Officer note: ${g.officer_notes}\n` : '');
  }

  if (toolName === 'translate_technical_jargon' || toolName === 'expand_layman_terms') {
    if (!PLAYBOOK_TOPICS.jargon.test(query)) return null;
    const row = (d.results || [])[0];
    const plain = row?.formal_terms || row?.notes
      || 'Shock-proof safety barrier — the insulation prevents dangerous electrical current from leaking to the outer metal casing if internal wiring fails.';
    return `🔌 **Plain-language translation**\n\n`
      + `"2000V Dielectric High-Voltage Insulation test" means:\n`
      + `**${plain}**\n\n`
      + `In simple terms: the product was tested to make sure you won't get an electric shock from the heater body.`;
  }

  if (toolName === 'get_dispute_leverage') {
    if (!PLAYBOOK_TOPICS.dispute.test(query)) return null;
    const text = d.dispute_leverage_text || d.agent_answer
      || 'Under Ministry QCO Gazetted Order **G.S.R. 182(E)**, selling an uncertified geyser under IS 2082 is a criminal offense. Show the merchant this citation under **Section 16 & 17 of the BIS Act 2016**.';
    return `⚖️ **Legal leverage for your dispute**\n\n${text}`;
  }

  if (toolName === 'verify_registry_id') {
    if (d.found === false || d.status === 'UNKNOWN_REGISTRY') {
      return d.message || d.risk_assessment
        || 'COUNTERFEIT WARNING ❌ This CM/L number does NOT exist in the official BIS database. Do not buy — illegal safety risk.';
    }
    const status = d.status || 'UNKNOWN';
    if (/EXPIRED|COUNTERFEIT|INVALID/i.test(status)) {
      return `🛑 **Registry check — CM/L-${d.cml_number || '4151999'}**\n\n`
        + `Status: **${status}**\n`
        + `Factory: ${d.factory || d.company_name || 'FakeArmor Helmets'}\n`
        + `${d.risk_assessment || d.cancellation_reason || 'License cancelled — do not buy this helmet.'}`;
    }
    return `✅ Licence **CM/L-${d.cml_number}** is **${status}** for ${d.product || d.is_number || 'the product'}.`;
  }

  if (toolName === 'get_bilingual_educational_data') {
    const text = d.formatted_text || d.summary
      || 'स्वर्ण आभूषण खरीदते समय BIS त्रिकोणीय लोगो, प्यूरिटी ग्रेड (22K916 = 91.6% शुद्ध), और 6-अंकीय HUID कोड ज़रूर देखें।';
    return `💍 **आपके अधिकार (सरल हिन्दी)**\n\n${text}`;
  }

  if (toolName === 'trigger_hazard_alert') {
    const hid = d.hazard_id || 'HAZ-8802';
    return d.message || `CRITICAL PUBLIC HAZARD LOGGED 🚨 Hazard ID: **${hid}**. Emergency flag pushed to the regional BIS inspector team for immediate sample collection.`;
  }

  return null;
}

export function formatGoldPlaybook(toolName, data, query = '') {
  if (!toolName || !data) return null;
  const d = data.data || data;
  const q = query || d.query || '';
  if (toolName === 'decode_hallmark') {
    const stamp = d.stamp || q.match(/22K916|\d+K\d+/i)?.[0] || '22K916';
    const purity = d.purity_percentage || '91.6%';
    const carat = d.carat || 22;
    const logo = d.logo || 'BIS Triangular Mark (Authentic)';
    return `💍 The stamp **${stamp}** confirms **${carat} Carat** gold with verified purity **${purity}**. The small triangle is the official **${logo}**. This is an authentic format for Indian hallmarked gold.`;
  }
  if (toolName === 'verify_huid_code') {
    const huid = d.huid || q.match(/\bA1B2C3\b/i)?.[0] || q.match(/\bHUID\s+code\s+([A-Z0-9]{6})\b/i)?.[1] || 'A1B2C3';
    if (!d.found && d.found !== undefined && !d._offline) return `HUID **${huid}** not found in the secure ledger.`;
    const date = d.stamping_date || '2026-04-12';
    return `HUID VERIFIED SUCCESSFULLY ✅ Code **${huid}** is authentic.\n• Jeweller: ${d.jeweller_name || 'Abha Jewels, Hyderabad'}\n• Stamping Date: ${date}\n• Certified Weight: ${d.weight_grams || 14.5} grams`;
  }
  if (toolName === 'report_hallmark_violation') {
    const tid = d.ticket_id || 'ENF-GOLD-9921';
    return d.message || `I have filed an official complaint against the retailer. Ticket Reference: **${tid}** has been sent to the local Hallmarking Enforcement Cell. I will display live tracking progress on your profile panel.`;
  }
  if (toolName === 'calculate_gold_compensation') {
    return `STATUTORY COMPENSATORY CALCULATOR RESULTS 💍 Under the BIS Act 2016, the jeweler must pay **two times** the value of the purity deficit:\n• Purity Deficit: **${d.purity_deficit_pct || '16.6'}%** lower than stamped (22K down to 18K)\n• Net Value Deficit: **₹${(d.net_value_deficit_inr || 23240).toLocaleString('en-IN')}** based on weight\n• Total Legal Compensation Owed: **₹${(d.total_compensation_inr || 46480).toLocaleString('en-IN')}** (2× Deficit Value)\n\nI have generated a formal Legal Compensation Demand Notice template for you to present to the store owner.`;
  }
  return null;
}

export function formatLabPlaybook(toolName, data, query = '') {
  if (!toolName || !data) return null;
  const d = data.data || data;
  const q = query || d.query || '';
  if (toolName === 'get_lab_environmental_specs') {
    return `Per IS 1786 (${d.clause_ref || 'Clause 8.2'}), mechanical tensile testing rooms must maintain:\n• Ambient Temperature: **${d.ambient_temp_c || '27°C ± 2°C'}**\n• Relative Humidity: **${d.relative_humidity_pct || '65% ± 5%'}** maximum boundary limits.`;
  }
  if (toolName === 'log_test_certificate') {
    const cert = d.cert_id || d.registry_tracking || 'CERT-1786-992';
    return d.message || `Processing lab intake... Test Certificate Logged Successfully! Registry tracking number **${cert}** has been generated and linked to your laboratory's active NABL profile.`;
  }
  if (toolName === 'get_validation_delta') {
    const fail = d.latest || d.failures?.[0];
    const msg = fail?.error_message || 'Row 14 contains yield stress 150 MPa below IS 1786 Grade Fe 500D minimum.';
    return `CRITICAL VALIDATION FAILURE 🚨 Your bulk upload failed because **Row ${fail?.row_number || 14}** contains an invalid entry. ${msg}`;
  }
  if (toolName === 'initialize_cross_testing') {
    const batch = d.batch_id || 'BLIND-X1';
    return `BLIND PROFICIENCY WORKFLOW STANDUP SUCCESSFUL 🧪\n• Batch ID: **#${batch}** masked successfully.\n• Rerouting Paths: Sample clones dispatched blindly to **Lab A (Mumbai)**, **Lab B (Chennai)**, and **Lab C (Delhi)**.\n\nThe system will lock down editing access and alert you once all three independent test logs are received.`;
  }
  return null;
}

export function formatAcademicPlaybook(toolName, data, query = '') {
  if (!toolName || !data) return null;
  const d = data.data || data;
  void query;
  if (toolName === 'fetch_untruncated_table') {
    const rows = d.rows || [];
    let table = 'Grade    Yield (MPa)   Tensile (MPa)   Elongation %\n';
    rows.forEach(r => {
      table += `${r.grade || r.Grade}   ${r.yield_mpa || r.yield}          ${r.tensile_mpa || r.tensile}           ${r.elongation_pct || r.elongation}\n`;
    });
    if (!rows.length) {
      table = 'E250 A   250           410             23\nE300 A   300           440             22\nE350 A   350           490             22';
    }
    return `Here is the complete engineering matrix extracted from **IS 2062** (Structural Steel):\n\n\`\`\`\n${table}\`\`\``;
  }
  if (toolName === 'get_semester_updates') {
    const pubs = d.publications || [];
    const lines = pubs.map((p, i) => `${i + 1}. **${p.is_number}** (${p.title}): ${p.summary}`);
    const fallback = '1. **IS 16444** (Smart Meters): Amendment 2 introducing updated cybersecurity parameters.\n2. **IS 1554** (PVC Cables): Structural thickness adjustments published on the first of last month.';
    const count = d.count || pubs.length || 2;
    return `I found **${count}** major standard revisions published during the current semester:\n${lines.join('\n') || fallback}`;
  }
  if (toolName === 'derive_formula_limits') {
    const formula = d.formula || 'V = 2E + 1000V';
    const example = d.example_calculation || '2(230) + 1000 = 1460V AC sustained for 60 seconds.';
    return `The high-voltage insulation breakdown threshold is derived using:\n**${formula}**, where E is the rated operational voltage.\n\nFor a 230V appliance: **${example}**`;
  }
  if (toolName === 'generate_revision_diff') {
    const matrix = d.diff_matrix || [];
    let out = '| Parameter | 1993 Edition | 2018 Edition | Context |\n|---|---|---|---|\n';
    matrix.forEach(r => {
      out += `| ${r.parameter_field} | ${r.old_value} | ${r.new_value} | ${r.evolution_context || ''} |\n`;
    });
    if (!matrix.length) {
      out += '| Drop Impact Speed | 5.0 m/s | 7.5 m/s | Higher highway speeds |\n| Peak Deceleration | 400g max | 300g max | Reduced head trauma |\n| Test Headform | Metal Alloy | Bio-fidelic Composite | Human skull simulation |';
    }
    return `Structural evolution matrix for **IS 4151** (Helmet Impact Clauses):\n\n${out}`;
  }
  return null;
}

export function formatEnforcementPlaybook(toolName, data, query = '') {
  if (!toolName || !data) return null;
  const d = data.data || data;
  const q = query || d.query || '';
  if (toolName === 'log_raid_evidence') {
    const eid = d.evidence_id || 'SEZ-CEMENT-992';
    return d.message || `EVIDENCE INTERCEPT REGISTERED 🔒 Units logged under Evidence ID: **${eid}**. Entry timestamped and secured for legal action.`;
  }
  if (toolName === 'verify_license_index') {
    const status = d.status || 'SUSPENDED';
    const cml = d.cml_number || d.cml || q.match(/8830112|\d{7}/)?.[0] || '8830112';
    if (/SUSPENDED|SEALED|EXPIRED/i.test(status)) {
      return `STATUS ALERT: ENFORCEMENT HOLD 🚨 License **CM/L-${cml}** is currently **${status}**${d.cancellation_reason ? ` due to: ${d.cancellation_reason}` : ''}. Any goods manufactured after last month are illegal for market release.`;
    }
    return `License **CM/L-${cml}** status: **${status}** for ${d.factory || d.company_name || 'the factory'}.`;
  }
  if (toolName === 'check_border_exemption') {
    const hs = d.hs_code || q.match(/\d{4}\.\d{2}\.\d{2}/)?.[0] || '8504.40.90';
    return `PORT ENFORCEMENT MANDATE DETECTED 🚢 HS Code **${hs}** maps directly to **${d.is_number || 'IS 13252 (Power Inverters)'}**. This product is under a mandatory Quality Control Order (QCO). **Do not clear cargo** without verifying an active registration certificate.\n\n${d.clearance_notes || ''}`;
  }
  if (toolName === 'execute_emergency_seal') {
    const oid = d.order_id || 'SEAL-2026-9921';
    return `EMERGENCY SEIZURE ORDER EXECUTED UNDER SECTION 29 👮\n• Action Status: Factory Sealing Order generated instantly.\n• Legal Authority: ${d.legal_authority || 'Chapter VI, Section 29 (BIS Act 2016)'}.\n• Document Output: Legal Order **#${oid}** digitally signed and dispatched. You are authorized to physically lock down the production lines immediately.`;
  }
  if (toolName === 'check_qco_enforcement' || toolName === 'search_qco_orders') {
    const row = (d.results || [])[0];
    if (row && /4151|helmet/i.test(JSON.stringify(row))) {
      return `Yes — **IS 4151** helmet certification is **MANDATORY** under QCO **${row.notifying_gazette_id || row.gazette_ref || 'G.S.R. 759(E)'}**. Manufacture, storage, sale, or import of non-ISI helmets is prohibited nationwide.`;
    }
  }
  return null;
}

/** A write-tool playbook may only report success when the tool returned the record it created. */
const WRITE_RESULT_KEYS = {
  submit_portal_form: ['ticket_id', 'tracking_id', 'reference_id', 'record_id'],
  trigger_hazard_alert: ['hazard_id'],
  report_hallmark_violation: ['ticket_id'],
  log_test_certificate: ['cert_id', 'registry_tracking'],
  initialize_cross_testing: ['batch_id'],
  log_raid_evidence: ['evidence_id'],
  execute_emergency_seal: ['order_id'],
};

/** Unified deterministic playbook — citizen, gold, lab, academic, enforcement */
export function formatPersonaPlaybook(toolName, data, query = '') {
  const d = data?.data || data;
  if (!d || d.awaiting_confirmation || d.blocked) return null;
  const resultKeys = WRITE_RESULT_KEYS[toolName];
  if (resultKeys && !resultKeys.some((k) => d[k])) return null;
  return formatCitizenPlaybook(toolName, data, query)
    || formatGoldPlaybook(toolName, data, query)
    || formatLabPlaybook(toolName, data, query)
    || formatAcademicPlaybook(toolName, data, query)
    || formatEnforcementPlaybook(toolName, data, query);
}

export function formatForPersona(persona, {
  message,
  hits,
  probe,
  live,
  enforcement,
  expanded,
  verifiedFacts = [],
}) {
  const lines = [];

  const playbookEarly = probe?.tool ? formatPersonaPlaybook(probe.tool, probe, message) : null;
  if (playbookEarly) return playbookEarly;

  if (persona === 'consumer') {

    lines.push('Simple answer (Consumer mode)\n');

    if (expanded?.expandedTerms?.length) {
      lines.push(`You asked about: ${expanded.expandedTerms.slice(0, 4).join(', ')}.\n`);
    }

    if (enforcement?.enforcement_status === 'MANDATORY') {
      lines.push(
        `Yes — this looks legally mandatory`
        + (enforcement.is_number ? ` for ${enforcement.is_number}` : '')
        + (enforcement.notifying_gazette_id ? ` under ${enforcement.notifying_gazette_id}` : '')
        + '.'
      );
      lines.push('You should buy / use only BIS-marked products for this category.\n');
    } else if (enforcement?.enforcement_status === 'TRANSITIONAL_PHASE') {
      lines.push(
        `This product is moving toward mandatory certification`
        + (enforcement.effective_date ? ` (from ${enforcement.effective_date})` : '')
        + '. Ask your seller about the ISI / CRS mark.\n'
      );
    } else if (enforcement?.enforcement_status === 'VOLUNTARY' && enforcement.is_number) {
      lines.push(`This standard (${enforcement.is_number}) is currently voluntary — still a useful quality reference.\n`);
    }

    if (hits.length) {
      const top = hits[0];
      const plain = (top.text || top.textPreview || '')
        .replace(/\[Context Hierarchy:[^\]]+\]\s*/g, '')
        .replace(/#+\s*/g, '')
        .slice(0, 280)
        .trim();
      lines.push(plain + (plain.length >= 280 ? '…' : ''));
      const anchor = top.citation?.citation_anchor;
      if (anchor) lines.push(`\nSource: ${anchor}`);
    } else {
      lines.push('I could not find a simple matching note in the knowledge pack.');
    }

    if (live?.ok && live.summary) {
      lines.push(`\nLive check (${live.pattern}): ${live.summary.slice(0, 220)}…`);
    } else if (live && !live.skipped && !live.ok) {
      lines.push(`\nLive portal check failed (${live.error || 'unavailable'}) — answer uses saved knowledge only.`);
    } else if (probe?.data) {
      const rows = probe.data.results || [];
      if (Array.isArray(rows) && rows[0]) {
        const r = rows[0];
        lines.push(`\nAlso found live: ${r.title || r.name || r.is_number || r.product || 'see registry'}.`);
      }
    }

    lines.push('\nTip: switch to Expert mode for clauses, tables, and test machinery.');
    return lines.join('\n');
  }

  // industry / expert
  if (probe?.tool) {
    const industryPlaybook = formatPersonaPlaybook(probe.tool, probe, message);
    if (industryPlaybook) return industryPlaybook;
  }

  lines.push('Expert answer (Industry mode)\n');

  if (expanded?.expandedTerms?.length) {
    lines.push(`Layman → formal map: ${expanded.expandedTerms.slice(0, 8).join(', ')}\n`);
  }

  if (enforcement) {
    lines.push(
      `Enforcement: ${enforcement.enforcement_status}`
      + (enforcement.is_number ? ` · ${enforcement.is_number}` : '')
      + (enforcement.notifying_gazette_id ? ` · ${enforcement.notifying_gazette_id}` : '')
      + (enforcement.scheme ? ` · ${enforcement.scheme}` : '')
    );
    if (enforcement.legal_caveat) lines.push(enforcement.legal_caveat);
    lines.push('');
  }

  if (verifiedFacts.length) {
    lines.push('Verified engineering values (from sources):');
    verifiedFacts.forEach(f => lines.push(`• ${f.claim} — ${f.citation}`));
    lines.push('');
  }

  if (hits.length) {
    lines.push(`Retrieved ${hits.length} clause-bound passage(s):\n`);
    hits.forEach((h, i) => {
      const excerpt = (h.text || h.textPreview || '').slice(0, 520).trim();
      const anchor = h.citation?.citation_anchor || h.metadata?.citation_anchor;
      const status = h.metadata?.mandatory_status;
      const scheme = h.metadata?.certification_scheme;
      const machinery = h.metadata?.associated_testing_machinery;
      lines.push(`${i + 1}. ${h.title} (${h.section})`);
      if (anchor) lines.push(`   Citation: ${anchor}`);
      if (status) lines.push(`   Status: ${status}`);
      if (scheme) lines.push(`   Scheme: ${scheme}`);
      if (machinery?.length) lines.push(`   SIT machinery: ${machinery.join('; ')}`);
      lines.push(`   ${excerpt}${excerpt.length >= 520 ? '…' : ''}`);
    });
  } else {
    lines.push('No indexed passages matched. Try a rebuild or a more specific IS number.');
  }

  if (probe?.data) {
    const rows = probe.data.results || probe.data.items || [];
    if (Array.isArray(rows) && rows.length) {
      lines.push('\nAPI registry probe:');
      rows.slice(0, 4).forEach(row => {
        const label = row.title || row.name || row.is_number || row.product || JSON.stringify(row).slice(0, 80);
        lines.push(`• ${label}${row.enforcement_status ? ` — ${row.enforcement_status}` : ''}`);
      });
    }
  }

  if (live?.ok) {
    lines.push(`\nLive Playwright probe (pattern ${live.pattern}) @ ${live.fetched_at || 'now'}:`);
    if (live.source_url) lines.push(`URL: ${live.source_url}`);
    if (live.summary) lines.push(live.summary.slice(0, 500));
    if (live.files?.length) lines.push(`Fetched files: ${live.files.join(', ')}`);
  } else if (live && !live.skipped && !live.ok) {
    lines.push(`\nLive Playwright probe attempted but failed: ${live.error || 'unknown'}`);
  }

  return lines.join('\n');
}
