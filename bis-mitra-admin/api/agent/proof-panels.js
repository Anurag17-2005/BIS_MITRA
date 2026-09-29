/**
 * Deterministic proof-of-action panels (actions 4–10). Facts come from Clone probes, not the LLM.
 */

function parseGoldCalcFromQuery(q) {
  const price = q.match(/(?:₹|rs\.?\s*|inr\s*)([\d,]+)\s*(?:per\s*gram|\/\s*g)/i)?.[1]?.replace(/,/g, '');
  return price ? Number(price) : null;
}

export function enrichProofPanel(query, probe, toolName) {
  const q = String(query || '');
  const tool = toolName || probe?.tool;
  const d = probe?.data || probe;
  if (!d) return null;

  if (tool === 'verify_import_compliance' || (/\bforeign\b.*\binduction\b/i.test(q) && /\b(outside|export|sell).*india\b/i.test(q))) {
    const row = (d.results || []).find((r) => /1003/i.test(r.is_number || ''))
      || (d.results || [])[0];
    if (!row && !/1003/i.test(q)) return null;
    return {
      uiMode: 'knowledge',
      checklist: {
        country: 'Foreign (user-specified)',
        product: row?.product_description || 'Domestic induction cooking appliance',
        standard: row?.is_number || 'IS DEMO 1003:2025',
        qco: 'QCO-DEMO-003',
        air_required: true,
        factory_inspection: true,
        testing: 'Test reports from a BIS-recognised laboratory',
        documents: ['Product specification', 'Factory quality plan', 'Test report', 'AIR Form-VI (Power of Attorney)'],
        pathway: row?.scheme || 'FMCS (Scheme-I)',
        source: row?.notes || 'FMCS-DEMO-003',
      },
      action: {
        id: 'start-fmcs',
        label: 'Start Foreign Manufacturer Application',
        prompt: 'I want to start a foreign manufacturer certification application for induction cooking appliances under IS DEMO 1003:2025.',
        advisory: true,
      },
    };
  }

  if (tool === 'suggest_testing_labs' || (/\blab(oratory)?\b/i.test(q) && /\binduction\b/i.test(q))) {
    const best = d.best_match || (d.results || [])[0];
    if (!best) return null;
    return {
      uiMode: 'knowledge',
      matching: {
        recommended: best.name,
        lab_code: best.lab_code,
        demo_id: best.demo_id || 'LAB-DEMO-001',
        city: best.city,
        state: best.state,
        scope: best.scope || best.capability,
        turnaround_days: best.queue_time_weeks ? best.queue_time_weeks * 7 : null,
        reason: 'Exact standard scope match for IS DEMO 1003:2025',
        results: (d.results || []).slice(0, 3),
      },
    };
  }

  if (tool === 'verify_registry_id' || /\bCML-DEMO-61003\b/i.test(q)) {
    if (d.found === false) {
      return {
        uiMode: 'verification',
        verification: {
          identifier: d.cml || 'CML-DEMO-61003',
          found: false,
          verified_at: new Date().toISOString(),
        },
      };
    }
    if (d.found) {
      return {
        uiMode: 'verification',
        verification: {
          identifier: d.cml_number || d.cml,
          found: true,
          match: true,
          manufacturer: d.company_name || d.factory,
          product: d.product,
          standard: d.is_number,
          licence_status: d.status,
          source: d.demo_id || 'CERT-DEMO-003',
          verified_at: new Date().toISOString(),
        },
      };
    }
  }

  if (tool === 'verify_huid_code' || /\bHUID-DM26-/i.test(q)) {
    const huid = d.huid || q.match(/HUID-DM26-[\w]+/i)?.[0];
    const flagged = d.verification_result === 'MISMATCH' || d.status === 'FLAGGED' || d.verified === false;
    const panel = {
      uiMode: flagged ? 'verification' : 'calculation',
      verification: {
        huid,
        found: d.found !== false,
        verified: !flagged,
        verification_result: flagged ? 'MISMATCH' : 'VERIFIED',
        flag_reason: d.flag_reason,
        jeweller: d.jeweller_name,
        assaying_center: d.assaying_center,
        weight_grams: d.weight_grams,
        source: d.demo_id,
        verified_at: d.verified_at || new Date().toISOString(),
      },
    };
    if (!flagged && d.weight_grams) {
      const price = parseGoldCalcFromQuery(q);
      const fineness = 916;
      const pureG = (Number(d.weight_grams) * fineness) / 1000;
      panel.calculation = {
        inputs: {
          weight_grams: d.weight_grams,
          fineness,
          price_per_gram_24k: price,
        },
        formula: 'pure_gold_g = weight × fineness / 1000; estimate = pure_gold_g × price_per_gram_24k',
        pure_gold_grams: pureG,
        estimated_value_inr: price ? Math.round(pureG * price) : null,
        caveat: 'Estimate only — excludes making charges, tax, stones, and deductions. Not a legal compensation figure.',
      };
    }
    return panel;
  }

  if (tool === 'generate_revision_diff' || /\bSTD-DEMO-010\b/i.test(q)) {
    const matrix = d.diff_matrix || [];
    if (!matrix.length && !d.old_standard_id) return null;
    return {
      uiMode: 'comparison',
      comparison: {
        old_standard_id: d.old_standard_id || 'STD-DEMO-010',
        new_standard_id: d.new_standard_id || 'STD-DEMO-011',
        old_is_number: d.old_is_number || 'IS DEMO 1010:2023',
        new_is_number: d.new_is_number || 'IS DEMO 1011:2026',
        rows: matrix.map((row) => ({
          aspect: row.parameter_field || row.aspect,
          parameter_field: row.parameter_field,
          old_requirement: row.old_value || row.old_requirement,
          new_requirement: row.new_value || row.new_requirement,
          old_value: row.old_value,
          new_value: row.new_value,
          change_type: row.evolution_context,
        })),
      },
    };
  }

  if (tool === 'search_enforcement_cases' || tool === 'search_surveillance' || /\bSURV-DEMO-001\b/i.test(q)) {
    const row = (d.results || [])[0];
    if (!row && !d.case_id) return null;
    return {
      uiMode: 'workflow',
      case: {
        case_id: row?.case_id || d.case_id || 'ENF-DEMO-001',
        manufacturer: row?.manufacturer,
        product: row?.product,
        standard: row?.is_number,
        licence: row?.licence_number,
        surveillance_ref: row?.surveillance_reference || 'SURV-DEMO-001',
        finding: row?.finding,
        evidence_required: ['Sealed sample reference', 'Inspection photographs', 'Test request form', 'Officer notes'],
        case_status: row?.case_status,
        evidence_history: row?.evidence_history || [],
      },
    };
  }

  return null;
}

export function mergeProofPanel(basePanel, proofExtra) {
  if (!proofExtra) return basePanel;
  return { ...basePanel, ...proofExtra };
}
