import { fetchClone, fetchClonePost } from './clone-client.js';

function enc(q) {
  return encodeURIComponent(String(q || '').trim());
}

/**
 * Execute a probe connector against Clone B REST API.
 * Used by the MITRA agent and bis-mitra-admin runner (api method).
 */
export async function executeProbeApi(connector, query = '') {
  const q = String(query || '').trim();

  switch (connector) {
    case 'standards_search': {
      const searchTerm = /industrial\s+safety\s+helmets?/i.test(q)
        ? 'industrial safety helmet'
        : q;
      const data = await fetchClone(`/api/standards?q=${enc(searchTerm)}`);
      return {
        query: q,
        resultCount: data.length,
        results: data.map(s => ({
          is_number: s.is_number,
          title: s.title,
          mandatory_voluntary: s.mandatory_voluntary,
          status: s.status,
          description: s.description,
          certification_applicability: s.certification_applicability,
          qco_reference: s.qco_reference,
          demo_id: s.demo_id,
          source_reference: s.source_reference,
          source_file: s.source_file,
          pdf_path: s.pdf_path,
        })),
      };
    }
    case 'standard_detail': {
      const isNumber = q || 'IS 623:2025';
      const data = await fetchClone(`/api/standards/${enc(isNumber)}/detail`);
      return { query: isNumber, ...data };
    }
    case 'fees_search': {
      const data = await fetchClone(`/api/marking-fees?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'compulsory_search': {
      const data = await fetchClone(`/api/compulsory-products?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'certification_search': {
      const data = await fetchClone(`/api/certification-list?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'manuals_search': {
      const data = await fetchClone(`/api/product-manuals?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'news_search': {
      const data = await fetchClone(`/api/news?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'application_search': {
      const path = q.startsWith('BIS-APP-')
        ? `/api/applications?reference_id=${enc(q)}`
        : `/api/applications?q=${enc(q)}`;
      const data = await fetchClone(path);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'workflow_status': {
      const idMatch = q.match(/\b(?:BIS-APP|CMP-DEMO|CERT-DEMO|LAB-APP|WF|CON-GRP)[\s-]?[\w-]+/i);
      const id = idMatch ? idMatch[0].replace(/\s+/g, '-') : q;
      const data = await fetchClone(`/api/ebis/status/${enc(id)}`);
      return { query: q, ...data };
    }
    case 'ebis_discover': {
      const data = await fetchClone(`/api/ebis/discover?q=${enc(q)}`);
      return { query: q, ...data };
    }
    case 'ebis_service': {
      const sid = q.match(/SVC-[\w-]+/)?.[0] || 'SVC-CERT-001';
      const data = await fetchClone(`/api/ebis/services/${enc(sid)}`);
      return { query: q, ...data };
    }
    case 'licence_search': {
      const path = q.includes('DEMO') || q.includes('_')
        ? `/api/licences?org_id=${enc(q)}`
        : `/api/licences?q=${enc(q)}`;
      const data = await fetchClone(path);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'fetch_orgdata': {
      const orgId = q.includes('DEMO') ? q : 'DEMO_MSME';
      const licences = await fetchClone(`/api/licences?org_id=${enc(orgId)}`);
      const companyTerms = licences.map(l => l.company_name).filter(Boolean);
      const appSets = await Promise.all([
        fetchClone(`/api/applications?q=${enc(q)}`),
        ...companyTerms.map(c => fetchClone(`/api/applications?q=${enc(c)}`)),
      ]);
      const seen = new Set();
      const apps = [];
      for (const batch of appSets) {
        for (const a of batch) {
          if (!seen.has(a.reference_id)) {
            seen.add(a.reference_id);
            apps.push(a);
          }
        }
      }
      return {
        query: q,
        org: orgId,
        licence_status: licences[0]?.status || 'active',
        licences,
        applications: apps.length,
        records: apps.slice(0, 20),
        note: 'Probe only — live org/licence snapshot from Clone B.',
      };
    }
    case 'hallmarking_search': {
      const data = await fetchClone(`/api/hallmarking-centres?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'labs_search': {
      const data = await fetchClone(`/api/labs?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'consumer_search': {
      const data = await fetchClone(`/api/consumer?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'qco_search': {
      const data = await fetchClone(`/api/qco?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'sit_search': {
      const data = await fetchClone(`/api/sit?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'synonym_search': {
      const data = await fetchClone(`/api/synonyms?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'certification_roadmap': {
      const isMatch = q.match(/IS\s*[\d\s().:]+/i);
      const isNumber = isMatch ? isMatch[0].trim() : 'IS 2082:2018';
      const enterprise = /large|corporate/i.test(q) ? 'large' : 'micro_msme';
      const data = await fetchClone(
        `/api/certification-roadmap?is_number=${enc(isNumber)}&enterprise_type=${enc(enterprise)}`
      );
      return { query: q, ...data };
    }
    case 'guidance_search': {
      const token = /\bvariant|endorsement|inclusion|scope\b/i.test(q) ? 'variant'
        : /\bmsme|udyam|simplified\b/i.test(q) ? 'msme'
          : q.split(/\s+/).find(w => w.length > 3) || q;
      const data = await fetchClone(`/api/guidance?q=${enc(token)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'compliance_alerts': {
      const data = await fetchClone('/api/compliance-alerts?unacknowledged=1');
      return { query: q, resultCount: data.length, results: data, alerts: data };
    }
    case 'fingerprint_check': {
      const data = await fetchClone('/api/v1/fingerprint/standards');
      let grievance = null;
      if (/complaint|extension board|yesterday|action|CON-GRP/i.test(q)) {
        try {
          const gList = await fetchClone('/api/consumer/grievances?ticket_id=CON-GRP-4401');
          grievance = gList?.[0] || null;
        } catch { /* ignore */ }
      }
      return {
        query: q,
        ...data,
        grievance,
        changed: (data.amendment_count || 0) > 0 || !!grievance,
      };
    }
    case 'amendments_search': {
      const clauseMatch = q.match(/clause\s*[\d.]+/i);
      const isMatch = q.match(/IS\s*[\d\s().:]+/i);
      let path = '/api/amendments?';
      if (isMatch) path += `is_number=${enc(isMatch[0].trim())}`;
      else if (clauseMatch) path += `q=${enc(clauseMatch[0])}`;
      else path += `q=${enc(q)}`;
      const data = await fetchClone(path);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'mock_inspection': {
      const isMatch = q.match(/IS\s*[\d\s().:]+/i);
      const isNumber = isMatch ? isMatch[0].trim() : (/helmet/i.test(q) ? 'IS 4151:2015' : 'IS 2082:2018');
      const data = await fetchClone(`/api/mock-inspection?is_number=${enc(isNumber)}`);
      return { query: q, ...data };
    }
    case 'org_profile': {
      const orgId = q.includes('DEMO') ? q : 'DEMO_MSME';
      const data = await fetchClone(`/api/org/${enc(orgId)}`);
      return { query: q, ...data };
    }
    case 'labs_ranked': {
      const cityMatch = q.match(/\b(Pune|Mumbai|Delhi|Bengaluru|Chennai|Hyderabad|Kolkata)\b/i);
      const capMatch = q.match(/IS\s*DEMO\s*1003[\d:]*/i)
        || q.match(/IS\s*[\d]+/i)
        || (/\binduction|cooking\s+appliance\b/i.test(q) ? 'IS DEMO 1003' : null)
        || (/\bgeyser|water\s*heater\b/i.test(q) ? 'IS 2082' : null)
        || (/\bhelmet\b/i.test(q) ? 'IS 4151' : null);
      const params = new URLSearchParams();
      if (cityMatch) params.set('city', cityMatch[1]);
      if (capMatch) params.set('capability', String(capMatch).replace(/:.*$/, ''));
      if (!cityMatch && !capMatch) params.set('q', q);
      let data = await fetchClone(`/api/labs?${params.toString()}`);
      if (!data.length && capMatch) {
        data = await fetchClone(`/api/labs?q=${enc(String(capMatch).includes('1003') ? '1003' : capMatch)}`);
      }
      const ranked = [...data].sort((a, b) => {
        const score = (row) => (/1003/i.test(`${row.scope || ''} ${row.capability || ''}`) ? 2 : 0)
          + (row.demo_id === 'LAB-DEMO-001' ? 1 : 0);
        return score(b) - score(a) || (a.queue_time_weeks || 99) - (b.queue_time_weeks || 99);
      });
      return { query: q, resultCount: ranked.length, results: ranked, best_match: ranked[0] || null };
    }
    case 'fmcs_lookup': {
      const data = await fetchClone(`/api/fmcs?q=${enc(/1003|induction/i.test(q) ? '1003' : q)}`);
      const ranked = [...data].sort((a, b) => {
        const score = (row) => (/1003/i.test(row.is_number || '') ? 2 : 0) + (/FMCS-DEMO-003/i.test(row.notes || '') ? 1 : 0);
        return score(b) - score(a);
      });
      return { query: q, resultCount: ranked.length, results: ranked };
    }
    case 'fmcs_submit': {
      // Handled directly in tools.js executeAgentTool via POST
      return { query: q, note: 'POST endpoint — handled in tools.js' };
    }
    case 'treaty_lookup': {
      const data = await fetchClone(`/api/treaty?country=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'fmcs_fees': {
      const zoneMatch = q.match(/Zone\s+(Europe|Asia|Americas)/i);
      const zone = zoneMatch ? zoneMatch[1] : (/europe|germany|uk/i.test(q) ? 'Europe' : 'Asia');
      const data = await fetchClone(`/api/fmcs/fees?zone=${enc(zone)}`);
      return { query: q, zone, ...data };
    }
    case 'fmcs_logistics': {
      const data = await fetchClone(`/api/guidance?q=fmcs-inspector-travel`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'air_template': {
      // Handled directly in tools.js executeAgentTool with template generation
      return { query: q, note: 'Template generation — handled in tools.js' };
    }
    case 'registry_verification': {
      const demoMatch = q.match(/(?:CML|LIC)-DEMO-[\w-]+/i)?.[0];
      const cmlMatch = q.match(/4151999|7200192|8100234|\d{7}/);
      const cml = demoMatch || (cmlMatch ? cmlMatch[0] : q.replace(/^CM\/L-?/i, '').trim());
      const data = await fetchClone(`/api/registry/verify?cml=${enc(cml)}`);
      return { query: q, cml, ...data };
    }
    case 'dispute_leverage': {
      const isMatch = q.match(/IS\s*[\d]+/i);
      const isNumber = isMatch ? isMatch[0] : (/geyser/i.test(q) ? 'IS 2082' : q);
      const data = await fetchClone(`/api/dispute-leverage?is_number=${enc(isNumber)}`);
      return { query: q, is_number: isNumber, ...data };
    }
    case 'bilingual_rights': {
      const lang = /hindi|hi\b|हिन्दी/i.test(q) ? 'hi' : 'en';
      const data = await fetchClone(`/api/bilingual-rights?topic=gold_hallmarking&lang=${enc(lang)}`);
      return { query: q, lang, ...data };
    }
    case 'hazard_alert': {
      // POST handled directly in tools.js / executeProbeApi
      const data = await fetchClone(`/api/consumer/grievances?q=hazard`);
      return { query: q, results: data };
    }
    case 'grievance_status': {
      const ticketId = q.match(/CMP-DEMO-[\w-]+/i)?.[0]
        || q.match(/CON-GRP-\d+/i)?.[0]
        || 'CON-GRP-4401';
      const data = await fetchClone(`/api/consumer/grievances?ticket_id=${enc(ticketId)}`);
      return { query: q, ticket_id: ticketId, results: data, record: data[0] || null };
    }
    case 'jargon_decoder': {
      const data = await fetchClone(`/api/synonyms?q=${enc(q)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'standards_catalog': {
      const token = /9873|toy/i.test(q) ? '9873' : q;
      const data = await fetchClone(`/api/standards-catalog?q=${enc(token)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'knowledge_base': {
      return { query: q, note: 'Handled in tools.js — merges RAG + standards catalog' };
    }
    case 'hallmark_decode': {
      const stamp = q.match(/22K916|\d+K\d+/i)?.[0] || q.replace(/stamp|triangle|bangle/gi, '').trim();
      const data = await fetchClone(`/api/gold/hallmark/decode?stamp=${enc(stamp)}`);
      return { query: q, stamp, ...data };
    }
    case 'huid_verify': {
      const huid = q.match(/HUID-DM26-[\w]+/i)?.[0]?.toUpperCase()
        || q.match(/HUID[\s-][\w-]+/i)?.[0]?.replace(/\s+/g, '-').toUpperCase()
        || q.replace(/huid|code|necklace/gi, '').trim().toUpperCase();
      const data = await fetchClone(`/api/gold/huid/verify?huid=${enc(huid)}`);
      return { query: q, huid, ...data };
    }
    case 'gold_compensation': {
      const data = await fetchClonePost('/api/gold/compensation/calculate', {
        promised_carat: 22,
        actual_carat: 18,
        weight_grams: Number(q.match(/(\d+)\s*gram/i)?.[1] || 20),
        paid_inr: Number(q.match(/₹?\s*([\d,]+)/)?.[1]?.replace(/,/g, '') || 140000),
      });
      return { query: q, ...data };
    }
    case 'lab_environmental': {
      const isMatch = q.match(/IS\s*[\d]+/i);
      const isNumber = isMatch ? isMatch[0] : (/1786/i.test(q) ? 'IS 1786' : q);
      const data = await fetchClone(`/api/lab/environmental-specs?is_number=${enc(isNumber)}`);
      return { query: q, ...data };
    }
    case 'validation_delta': {
      const data = await fetchClone('/api/v1/validation/logs?upload_id=BULK-UPLOAD-992');
      return { query: q, ...data };
    }
    case 'engineering_table': {
      const isMatch = q.match(/IS\s*[\d]+/i);
      const isNumber = isMatch ? isMatch[0] : (/2062/i.test(q) ? 'IS 2062' : q);
      const data = await fetchClone(`/api/academic/engineering-table?is_number=${enc(isNumber)}`);
      return { query: q, ...data };
    }
    case 'semester_updates': {
      const data = await fetchClone('/api/academic/semester-updates');
      return { query: q, ...data };
    }
    case 'formula_derivation': {
      const data = await fetchClone(`/api/academic/formula-derivation?topic=${enc(q)}`);
      return { query: q, ...data };
    }
    case 'revision_diff': {
      const token = /STD-DEMO-010|STD-DEMO-011|1010|1011/i.test(q) ? 'STD-DEMO-010' : (q.match(/IS\s*[\d]+/i)?.[0] || (/4151/i.test(q) ? 'IS 4151' : q));
      const data = await fetchClone(`/api/academic/revision-diff?is_number=${enc(token)}`);
      return { query: q, ...data };
    }
    case 'border_exemption': {
      const hs = q.match(/\d{4}\.\d{2}\.\d{2}/)?.[0] || '8504.40.90';
      const data = await fetchClone(`/api/enforcement/border-exemption?hs_code=${enc(hs)}`);
      return { query: q, hs_code: hs, ...data };
    }
    case 'license_index': {
      const cmlMatch = q.match(/8830112|4151999|\d{7}/);
      const cml = cmlMatch ? cmlMatch[0] : q.replace(/^CM\/L-?/i, '').trim();
      const data = await fetchClone(`/api/registry/verify?cml=${enc(cml)}`);
      return { query: q, cml, ...data };
    }
    case 'enforcement_search': {
      const caseMatch = q.match(/ENF-DEMO-\d+/i);
      const survMatch = q.match(/SURV-DEMO-\d+/i);
      const token = caseMatch ? caseMatch[0] : (survMatch ? survMatch[0] : q);
      let data = await fetchClone(`/api/enforcement/cases?q=${enc(token)}`);
      if (survMatch && (!data.length || /SURV-DEMO/i.test(q))) {
        const survRows = await fetchClone(`/api/surveillance?surveillance_id=${enc(survMatch[0])}`);
        const surv = Array.isArray(survRows) ? survRows[0] : null;
        if (surv) {
          const caseId = surv.enforcement_case_reference || surv.case_id || 'ENF-DEMO-001';
          const caseRows = data.length ? data : await fetchClone(`/api/enforcement/cases?case_id=${enc(caseId)}`);
          data = (caseRows.length ? caseRows : [{ case_id: caseId }]).map((row) => ({
            ...row,
            surveillance_reference: surv.surveillance_id || survMatch[0],
            finding: row.finding || surv.test_result,
            evidence_history: row.evidence_history || surv.evidence_history || [],
          }));
        }
      }
      return { query: q, resultCount: data.length, results: data };
    }
    case 'surveillance_search': {
      const survMatch = q.match(/SURV-DEMO-\d+/i);
      const token = survMatch ? survMatch[0] : q;
      const data = await fetchClone(`/api/surveillance?q=${enc(token)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    case 'consumer_complaints_search': {
      const ticketMatch = q.match(/CMP-DEMO-\d+|CON-GRP-\d+/i);
      const token = ticketMatch ? ticketMatch[0] : q;
      const data = await fetchClone(`/api/consumer/grievances?q=${enc(token)}`);
      return { query: q, resultCount: data.length, results: data };
    }
    default:
      throw new Error(`Unknown probe connector: ${connector}`);
  }
}
