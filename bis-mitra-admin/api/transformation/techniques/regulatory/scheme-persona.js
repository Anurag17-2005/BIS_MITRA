/**
 * Bind documents to BIS certification schemes and user personas.
 */

const SCHEME_I = 'Scheme-I (ISI Mark)';
const SCHEME_II = 'Scheme-II (CRS)';
const SCHEME_IV = 'Scheme-IV (Hallmarking)';

export function inferSchemeType({ domain, text = '', title = '', isNumbers = [], enforcement } = {}) {
  if (enforcement?.scheme) return enforcement.scheme;

  const blob = `${domain} ${title} ${text}`.toLowerCase();
  if (/hallmark|huid|precious metal|gold|silver|jewellery|assaying/.test(blob) || domain === 'hallmarking') {
    return SCHEME_IV;
  }
  if (/crs|scheme-?ii|electronics|led lamp|it equipment|15844|13252/.test(blob)) {
    return SCHEME_II;
  }
  if (/scheme-?i|isi mark|product certification/.test(blob)) {
    return SCHEME_I;
  }
  if (domain === 'consumer') return SCHEME_IV;
  if (['manuals', 'fees', 'standards', 'process', 'schemes'].includes(domain)) {
    return SCHEME_I;
  }
  return enforcement?.scheme || 'Unclassified';
}

export function inferPersonaTarget({ domain, text = '', title = '' } = {}) {
  const blob = `${domain} ${title} ${text}`.toLowerCase();
  if (
    domain === 'consumer'
    || domain === 'hallmarking'
    || /complaint|grievance|consumer|verify.*mark|rights/.test(blob)
  ) {
    return 'consumer';
  }
  if (
    domain === 'fees'
    || domain === 'manuals'
    || domain === 'process'
    || domain === 'labs'
    || /factory|marking fee|testing|licence|application|sit |sti |machinery/.test(blob)
  ) {
    return 'industry';
  }
  if (domain === 'news' || domain === 'standards' || domain === 'schemes') {
    return 'both';
  }
  return 'both';
}

export function buildRegulatoryTags(ctx) {
  const enforcement = ctx.enforcement || {
    enforcement_status: 'VOLUNTARY',
    legal_caveat: 'No QCO matched.',
  };
  return {
    legal_status: enforcement.enforcement_status,
    scheme_type: inferSchemeType({ ...ctx, enforcement }),
    persona_target: inferPersonaTarget(ctx),
    enforcement,
  };
}
