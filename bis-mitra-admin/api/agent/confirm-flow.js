import { submitPortalForm } from './form-submit.js';
import { updateContext, getContext } from '../context/context-store.js';
import { fetchClonePost } from '../core/clone-client.js';

const MANAK_BASE = process.env.MANAK_APPLICATIONS_URL
  || process.env.VITE_MANAK_URL
  || 'http://localhost:3002';
export const APPLICATIONS_URL = `${MANAK_BASE.replace(/\/$/, '')}/applications`;

export const CERT_PERSONAS = new Set(['industry', 'foreign_exporter']);

const APPLY_RE = /\b(please apply|apply now|apply for|i want to apply|start (an? )?(application|fmcs)|submit (the |my )?(application|form)|file (a |an |the )?(official )?(complaint|grievance)|form-?i|fmcs licence)\b/i;
const CERT_APPLY_RE = /\b(please apply|apply now|apply for|i want to apply|start (an? )?(application|fmcs)|submit (the |my )?(application|form)|form-?i|fmcs|product certification|isi mark)\b/i;
const CANCEL_RE = /^(cancel|stop|never mind|not now|रद्द)/i;
const CONFIRM_RE = /^(confirm|yes|submit|ok|okay|पुष्टि|हाँ|हां)\b/i;

const INDUSTRY_FIELDS = ['factory', 'udyam', 'standard', 'product', 'lab_report'];
const FMCS_FIELDS = ['factory', 'country', 'air_name', 'standard', 'product'];

const QUESTIONS = {
  en: {
    factory: 'What is the factory / company name to put on the certification application?',
    udyam: 'What is the Udyam MSME registration ID? (for example UDYAM-MH-12-0012345)',
    standard: 'Which IS number should we apply against? (for example IS 2082:2018)',
    product: 'What is the product name for this application?',
    lab_report: 'What is the independent lab test report reference? (for example NTH-9941)',
    country: 'What is the country of origin of the factory?',
    air_name: 'Who is the Authorised Indian Representative (AIR)?',
  },
  hi: {
    factory: 'प्रमाणन आवेदन पर कौन सा कारखाना / कंपनी नाम लिखूँ?',
    udyam: 'उद्यम MSME पंजीकरण आईडी क्या है? (जैसे UDYAM-MH-12-0012345)',
    standard: 'किस IS संख्या पर आवेदन करना है? (जैसे IS 2082:2018)',
    product: 'उत्पाद का नाम क्या है?',
    lab_report: 'स्वतंत्र प्रयोगशाला परीक्षण रिपोर्ट संदर्भ क्या है? (जैसे NTH-9941)',
    country: 'कारखाने का मूल देश कौन सा है?',
    air_name: 'भारतीय प्राधिकृत प्रतिनिधि (AIR) कौन है?',
  },
};

export function wantsApplication(message) {
  return APPLY_RE.test(String(message || ''));
}

export function wantsCertApplication(message) {
  return CERT_APPLY_RE.test(String(message || ''));
}

export function submissionKind(personaId, query) {
  const q = String(query || '');
  if (personaId === 'citizen' || /complaint|grievance|शिकायत/i.test(q)) return 'complaint';
  if (personaId === 'foreign_exporter' || /\bfmcs\b/i.test(q)) return 'fmcs';
  if (personaId === 'lab_testing' || /sample report|log a sample/i.test(q)) return 'lab_report';
  if (personaId === 'enforcement') return 'notice';
  return 'certification';
}

function requiredFields(kind) {
  return kind === 'fmcs' ? FMCS_FIELDS : INDUSTRY_FIELDS;
}

export function factsFromText(text, profile = {}) {
  const blob = String(text || '');
  const patch = {};
  const udyam = blob.match(/UDYAM-[A-Z0-9-]+/i);
  if (udyam) patch.udyam = udyam[0].toUpperCase();
  const isn = blob.match(/IS\s*(?:DEMO\s+)?\d[\d\s:().A-Z-]*/i);
  if (isn) patch.standard = isn[0].replace(/\s+/g, ' ').trim();
  const lab = blob.match(/\b(?:NTH|IL|TR|LAB)[- ]?\d[\w-]*/i);
  if (lab) patch.lab_report = lab[0].replace(/\s+/g, '').toUpperCase();
  if (profile.city) patch.city = profile.city;
  if (profile.udyam && !patch.udyam) patch.udyam = profile.udyam;
  if (profile.org) patch.org = profile.org;
  if (profile.org && !patch.factory) patch.factory = profile.org;
  if (profile.products && !patch.product) patch.product = profile.products;
  if (profile.country) patch.country = profile.country;
  if (profile.air_name) patch.air_name = profile.air_name;
  return patch;
}

function fillAwaiting(field, message, profile) {
  const text = String(message || '').trim();
  const extracted = factsFromText(text, {});
  if (extracted[field]) return extracted[field];
  if (!text || wantsCertApplication(text) || CONFIRM_RE.test(text)) return '';
  if (field === 'udyam' && !/udyam/i.test(text) && text.length < 6) return '';
  if (field === 'standard' && !/^IS\b/i.test(text) && text.length > 80) return '';
  if (profile?.[field]) return '';
  return text.slice(0, 120);
}

function mergeFacts({ message, profile = {}, sessionInfo = {}, awaitingField }) {
  const fromProfile = factsFromText('', profile);
  const fromSession = { ...fromProfile, ...(sessionInfo || {}) };
  const fromText = factsFromText(message, {});
  const next = { ...fromSession, ...fromText };
  if (awaitingField && !next[awaitingField]) {
    const filled = fillAwaiting(awaitingField, message, profile);
    if (filled) next[awaitingField] = filled;
  }
  if (next.org && !next.factory) next.factory = next.org;
  return next;
}

function missingFields(kind, facts) {
  return requiredFields(kind).filter((key) => !String(facts[key] || '').trim());
}

export function rememberFacts(sessionId, { userId, persona, text, profile }) {
  if (!sessionId) return factsFromText(text, profile);
  const patch = factsFromText(`${text || ''}\n${JSON.stringify(profile || {})}`, profile);
  updateContext(sessionId, { userInfo: { ...(profile || {}), ...patch } }, { userId, persona });
  return patch;
}

function tableFor(kind, facts) {
  if (kind === 'fmcs') {
    const columns = ['Company', 'Country', 'AIR', 'Product', 'IS'];
    const row = [facts.factory, facts.country, facts.air_name, facts.product, facts.standard];
    return {
      kind,
      columns,
      rows: [row],
      missing: missingFields(kind, facts),
      fields: {
        factory: facts.factory,
        country: facts.country,
        air_name: facts.air_name,
        product: facts.product,
        product_name: facts.product,
        is_number: facts.standard,
        standard: facts.standard,
      },
    };
  }
  const columns = ['Factory', 'Product', 'IS', 'Udyam', 'Lab report'];
  const row = [facts.factory, facts.product, facts.standard, facts.udyam, facts.lab_report];
  return {
    kind,
    columns,
    rows: [row],
    missing: missingFields(kind, facts),
    fields: {
      factory: facts.factory,
      product: facts.product,
      product_name: facts.product,
      is_number: facts.standard,
      standard: facts.standard,
      udyam: facts.udyam,
      lab_report: facts.lab_report,
      city: facts.city,
    },
  };
}

export function buildConfirmTable({ personaId, query, profile = {}, history = [], sessionInfo = {} }) {
  const blob = [query, ...history.map((m) => m.text || ''), JSON.stringify(profile)].join('\n');
  const kind = submissionKind(personaId, query);
  const facts = mergeFacts({ message: blob, profile, sessionInfo });
  if (kind === 'complaint') {
    const columns = ['Product', 'Seller', 'Mark', 'Bill', 'Issue'];
    const row = [facts.product, profile.seller || '', profile.licence || '', profile.bill || '', String(query).slice(0, 80)];
    return { kind, columns, rows: [row], missing: columns.filter((c, i) => !row[i]), fields: facts };
  }
  return tableFor(kind, facts);
}

export async function runConfirmedSubmit(table, extras = {}) {
  const fields = table?.fields || {};
  const owner = {
    owner_session_id: extras.sessionId || null,
    owner_user_id: extras.userId || null,
    owner_persona: extras.personaId || null,
  };
  if (table?.kind === 'fmcs') {
    const api = await fetchClonePost('/api/fmcs/applications', {
      company_name: fields.factory || 'Foreign manufacturer',
      country_of_origin: fields.country,
      air_name: fields.air_name,
      is_number: fields.is_number,
      product_name: fields.product_name || fields.product,
      ...owner,
    });
    return {
      ok: true,
      reference_id: api.reference_id,
      tracking_id: api.tracking_id || api.reference_id,
      source: 'fmcs-api',
      message: api.message,
    };
  }
  return submitPortalForm({
    query: 'confirmed certification',
    factory_name: fields.factory || fields.product || 'Rahul Water Heaters',
    udyam_id: fields.udyam,
    is_number: fields.is_number || undefined,
    product_name: fields.product_name || fields.product,
    lab_report_ref: fields.lab_report,
    confirm: true,
    ...owner,
  });
}

export function confirmAnswer(table, language) {
  const gap = table.missing?.length
    ? (language === 'hi'
      ? `ये खाली हैं: ${table.missing.join(', ')}. इन्हें भरें, फिर पुष्टि करें।`
      : `These are still empty: ${table.missing.join(', ')}. Fill them, then confirm.`)
    : (language === 'hi'
      ? 'ये वही डेटा हैं जो मैं प्रमाणन आवेदन पर भरूँगा। पुष्टि से पहले कुछ जमा नहीं होगा।'
      : 'These are the data I will submit for certification. Nothing is filed until you confirm.');
  return gap;
}

function questionFor(field, language) {
  const pack = QUESTIONS[language] || QUESTIONS.en;
  return pack[field] || QUESTIONS.en[field];
}

/**
 * Industry / foreign exporter: ask one field at a time, then show a confirm table, then submit.
 */
export async function handleCertificationTurn({
  personaId,
  message,
  profile = {},
  history = [],
  sessionId,
  portalSessionId,
  userId,
  language = 'en',
  confirmSubmit = false,
  confirmFields = null,
} = {}) {
  const kind = submissionKind(personaId, message);
  const stored = sessionId ? (getContext(sessionId) || {}) : {};
  const collecting = stored.currentTask === 'certification_collect'
    || wantsCertApplication(message)
    || confirmSubmit
    || Boolean(confirmFields);

  if (!CERT_PERSONAS.has(personaId) || !collecting) {
    return { handled: false };
  }

  if (CANCEL_RE.test(String(message || '').trim())) {
    if (sessionId) {
      updateContext(sessionId, { currentTask: null, awaitingField: null }, { userId, persona: personaId });
    }
    return {
      handled: true,
      answer: language === 'hi' ? 'आवेदन रद्द किया।' : 'Application cancelled.',
      table: null,
      submitted: null,
      facts: stored.userInfo || {},
      uiMode: 'chat',
    };
  }

  const awaitingField = stored.awaitingField || null;
  const facts = mergeFacts({
    message,
    profile: { ...(profile || {}), ...(confirmFields || {}) },
    sessionInfo: stored.userInfo || {},
    awaitingField,
  });
  if (confirmFields) Object.assign(facts, confirmFields);

  const missing = missingFields(kind, facts);
  const nextField = missing[0] || null;
  const table = tableFor(kind, facts);

  if (sessionId) {
    updateContext(sessionId, {
      currentTask: 'certification_collect',
      awaitingField: nextField,
      userInfo: facts,
    }, { userId, persona: personaId });
  }

  const wantsNow = confirmSubmit || CONFIRM_RE.test(String(message || '').trim());

  if (missing.length && !wantsNow) {
    const already = requiredFields(kind)
      .filter((k) => facts[k])
      .map((k) => `**${k}:** ${facts[k]}`)
      .join('\n');
    const intro = language === 'hi'
      ? 'प्रमाणन आवेदन के लिए कुछ विवरण चाहिए। एक-एक करके पूछता हूँ।'
      : 'I will collect the certification fields one at a time, then show you the data I will submit.';
    const answer = [
      history.some((m) => m.role === 'assistant') ? '' : intro,
      already ? (language === 'hi' ? `अब तक:\n${already}` : `So far:\n${already}`) : '',
      questionFor(nextField, language),
    ].filter(Boolean).join('\n\n');
    return {
      handled: true,
      answer,
      table: null,
      submitted: null,
      facts,
      missing,
      uiMode: 'collect',
    };
  }

  if (missing.length && wantsNow) {
    return {
      handled: true,
      answer: confirmAnswer(table, language),
      table,
      submitted: null,
      facts,
      missing,
      uiMode: 'confirm',
    };
  }

  if (wantsNow) {
    const submitted = await runConfirmedSubmit(table, {
      sessionId: portalSessionId || sessionId,
      userId,
      personaId,
    });
    if (sessionId) {
      const ref = submitted.reference_id || submitted.tracking_id;
      const ctx = getContext(sessionId) || {};
      updateContext(sessionId, {
        currentTask: null,
        awaitingField: null,
        activeRecordId: ref,
        watchedRecords: [...new Set([...(ctx.watchedRecords || []), ref])],
        userInfo: facts,
      }, { userId, persona: personaId });
    }
    const ref = submitted.reference_id || submitted.tracking_id || 'BIS-APP';
    const answer = language === 'hi'
      ? `आवेदन जमा हो गया। क्रमांक **${ref}**। यह eBIS आवेदनों और आपके “मेरे आवेदन” में दिखेगा।`
      : `Application submitted. Reference **${ref}**. It now appears on eBIS Applications and in My Applications.`;
    return {
      handled: true,
      answer,
      table: null,
      submitted,
      facts,
      missing: [],
      uiMode: 'status',
    };
  }

  return {
    handled: true,
    answer: confirmAnswer(table, language),
    table,
    submitted: null,
    facts,
    missing: [],
    uiMode: 'confirm',
  };
}
