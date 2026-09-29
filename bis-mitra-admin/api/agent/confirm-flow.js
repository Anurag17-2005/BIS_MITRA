import { submitPortalForm } from './form-submit.js';
import { updateContext, getContext } from '../context/context-store.js';
import { fetchClonePost } from '../core/clone-client.js';
import { wantsComplaintFiling } from './router/intents.js';

const MANAK_BASE = process.env.MANAK_APPLICATIONS_URL
  || process.env.VITE_MANAK_URL
  || 'http://localhost:3002';
export const APPLICATIONS_URL = `${MANAK_BASE.replace(/\/$/, '')}/applications`;

export const CERT_PERSONAS = new Set(['industry', 'foreign_exporter']);

const APPLY_RE = /\b(please apply|apply now|apply for|i want to apply|start (an? )?(application|fmcs)|submit (the |my )?(application|form)|form-?i|fmcs licence)\b/i;
const CERT_APPLY_RE = /\b(please apply|apply now|apply for|i want to apply|start (an? )?(application|fmcs)|submit (the |my )?(application|form)|form-?i|fmcs|product certification|isi mark)\b/i;
const CANCEL_RE = /^(cancel|stop|never mind|not now|रद्द)/i;
const CONFIRM_RE = /^(confirm|yes|submit|ok|okay|पुष्टि|हाँ|हां)\b/i;

const INDUSTRY_FIELDS = ['factory', 'udyam', 'standard', 'product', 'lab_report', 'contact_email', 'declaration'];
const FMCS_FIELDS = ['factory', 'country', 'air_name', 'standard', 'product'];

const QUESTIONS = {
  en: {
    factory: 'What is the factory / company name to put on the certification application?',
    udyam: 'What is the Udyam MSME registration ID? (for example UDYAM-MH-12-0012345)',
    standard: 'Which IS number should we apply against? (for example IS 2082:2018)',
    product: 'What is the product name for this application?',
    lab_report: 'What is the independent lab test report reference? (for example NTH-9941)',
    contact_email: 'What contact email should BIS use for this application?',
    declaration: 'Please type “I declare” to confirm that the application details and attached test evidence are accurate.',
    country: 'What is the country of origin of the factory?',
    air_name: 'Who is the Authorised Indian Representative (AIR)?',
  },
  hi: {
    factory: 'प्रमाणन आवेदन पर कौन सा कारखाना / कंपनी नाम लिखूँ?',
    udyam: 'उद्यम MSME पंजीकरण आईडी क्या है? (जैसे UDYAM-MH-12-0012345)',
    standard: 'किस IS संख्या पर आवेदन करना है? (जैसे IS 2082:2018)',
    product: 'उत्पाद का नाम क्या है?',
    lab_report: 'स्वतंत्र प्रयोगशाला परीक्षण रिपोर्ट संदर्भ क्या है? (जैसे NTH-9941)',
    contact_email: 'इस आवेदन के लिए BIS किस संपर्क ईमेल का उपयोग करे?',
    declaration: 'विवरण और परीक्षण प्रमाण सही होने की पुष्टि के लिए “मैं घोषणा करता हूँ” लिखें।',
    country: 'कारखाने का मूल देश कौन सा है?',
    air_name: 'भारतीय प्राधिकृत प्रतिनिधि (AIR) कौन है?',
  },
};

export function wantsApplication(message) {
  return APPLY_RE.test(String(message || '')) || wantsComplaintFiling(message);
}

export { wantsComplaintFiling };

export function wantsCertApplication(message) {
  return CERT_APPLY_RE.test(String(message || ''));
}

export function submissionKind(personaId, query) {
  const q = String(query || '');
  if (personaId === 'citizen' || wantsComplaintFiling(q) || /complaint|grievance|शिकायत/i.test(q)) return 'complaint';
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
  const isn = blob.match(/\bIS\s+(?:DEMO\s+)?\d{3,5}(?:\s*\([^)]*\))?(?::\d{4})?\b/i);
  if (isn) patch.standard = isn[0].replace(/\s+/g, ' ').trim();
  const lab = blob.match(/\b(?:NTH|IL|TR|LAB)[- ]?\d[\w-]*/i);
  if (lab) patch.lab_report = lab[0].replace(/\s+/g, '').toUpperCase();
  const email = blob.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  if (email) patch.contact_email = email[0].toLowerCase();
  if (/\b(i\s+declare|declaration\s+accepted|मैं\s+घोषणा)\b/i.test(blob)) {
    patch.declaration = 'Accepted';
  }
  if (profile.city) patch.city = profile.city;
  if (profile.udyam && !patch.udyam) patch.udyam = profile.udyam;
  if (profile.org) patch.org = profile.org;
  if (profile.org && !patch.factory) patch.factory = profile.org;
  if (profile.products && !patch.product) patch.product = profile.products;
  if (profile.country) patch.country = profile.country;
  if (profile.air_name) patch.air_name = profile.air_name;
  if (profile.email && !patch.contact_email) patch.contact_email = profile.email;
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
  const columns = ['Factory', 'Product', 'IS', 'Udyam', 'Lab report', 'Contact', 'Declaration'];
  const row = [
    facts.factory,
    facts.product,
    facts.standard,
    facts.udyam,
    facts.lab_report,
    facts.contact_email,
    facts.declaration,
  ];
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
      contact_email: facts.contact_email,
      declaration: facts.declaration,
      city: facts.city,
    },
  };
}

export function buildConfirmTable({ personaId, query, profile = {}, history = [], sessionInfo = {} }) {
  const blob = [query, ...history.map((m) => m.text || ''), JSON.stringify(profile)].join('\n');
  const kind = submissionKind(personaId, query);
  const facts = mergeFacts({ message: blob, profile, sessionInfo });
  if (kind === 'complaint') {
    return complaintTable({
      ...complaintFactsFromText(query),
      ...pick(profile, COMPLAINT_FIELDS),
      ...pick(sessionInfo?.complaint || {}, COMPLAINT_FIELDS),
    });
  }
  return tableFor(kind, facts);
}

const COMPLAINT_FIELDS = ['product', 'seller', 'bill', 'issue'];
const COMPLAINT_QUESTIONS = {
  en: {
    product: 'Which product is the complaint about? (brand and product name, for example “Bajaj mixer grinder”)',
    seller: 'Which shop, seller, or website did you buy it from?',
    bill: 'What is the bill / invoice number? (type “none” if you do not have it)',
    issue: 'In one or two sentences, what went wrong with the product?',
  },
  hi: {
    product: 'शिकायत किस उत्पाद के बारे में है? (ब्रांड और उत्पाद का नाम)',
    seller: 'आपने इसे किस दुकान, विक्रेता या वेबसाइट से खरीदा?',
    bill: 'बिल / इनवॉइस नंबर क्या है? (न हो तो “none” लिखें)',
    issue: 'एक-दो वाक्यों में बताइए, उत्पाद में क्या खराबी है?',
  },
};
const GENERIC_WORDS = new Set(['a', 'an', 'the', 'my', 'this', 'defective', 'faulty', 'broken', 'bad', 'product', 'item', 'thing', 'consumer']);

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj?.[k]) out[k] = obj[k];
  return out;
}

function isGenericPhrase(text) {
  const words = String(text || '').toLowerCase().match(/[a-z\u0900-\u097f]+/g) || [];
  return !words.length || words.every((w) => GENERIC_WORDS.has(w));
}

/** Pull complaint facts out of free text without guessing. */
export function complaintFactsFromText(text) {
  const blob = String(text || '');
  const facts = {};
  const bill = blob.match(/\b(INV[\s#:-]*\d[\w-]*)/i)
    || blob.match(/\b(?:bill|invoice)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][\w-]*\d[\w-]*)/i);
  if (bill) facts.bill = bill[1].replace(/\s+/g, '').toUpperCase();
  const seller = blob.match(/\b(?:bought|purchased)\s+(?:it\s+)?(?:from|at)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,4})/)
    || blob.match(/\b(?:seller|shop|store|merchant)\s*(?:is|:|named)?\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,4})/);
  if (seller) facts.seller = seller[1].trim();
  const about = blob.match(/\b(?:complaint|complain)\s+(?:about|against|regarding|for)\s+(?:a|an|the|my)?\s*([^.,;!?]{3,60})/i);
  if (about) {
    const phrase = about[1].replace(/\b(?:that|which|because|bought|purchased)\b.*$/i, '').trim();
    if (!isGenericPhrase(phrase)) facts.product = phrase.replace(/^(?:defective|faulty|broken)\s+/i, '');
  }
  const issue = blob.match(/\b(?:because|as|it)\s+((?:caught|stopped|broke|leaks?|leaked|smokes?|sparked|burnt|burned|overheat\w*|is\s+not|does\s+not|doesn'?t|won'?t|gave|gives|shocks?)[^.!?]{3,160})/i);
  if (issue) facts.issue = issue[1].trim();
  return facts;
}

function complaintTable(facts) {
  const columns = ['Product', 'Seller', 'Bill', 'Issue'];
  const row = [facts.product, facts.seller, facts.bill, facts.issue];
  return {
    kind: 'complaint',
    columns,
    rows: [row],
    missing: COMPLAINT_FIELDS.filter((k) => !String(facts[k] || '').trim()),
    fields: {
      product: facts.product,
      product_name: facts.product,
      seller: facts.seller,
      bill: facts.bill,
      issue: facts.issue,
    },
  };
}

export async function runConfirmedSubmit(table, extras = {}) {
  const fields = table?.fields || {};
  const owner = {
    owner_session_id: extras.sessionId || null,
    owner_user_id: extras.userId || null,
    owner_persona: extras.personaId || null,
  };
  if (table?.kind === 'complaint') {
    const bill = String(fields.bill || '').trim();
    return submitPortalForm({
      isGrievance: true,
      merchant_name: fields.seller,
      product_name: fields.product_name || fields.product,
      product_category: fields.product_name || fields.product,
      invoice_number: /^none$/i.test(bill) ? 'Not provided' : bill,
      complaint_details: fields.issue,
      evidence_upload: /^none$/i.test(bill) ? 'Not provided' : `${bill || 'invoice'}.pdf`,
      ...owner,
    });
  }
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
    contact_email: fields.contact_email,
    declaration: fields.declaration,
    confirm: true,
    ...owner,
  });
}

export function confirmAnswer(table, language) {
  if (table?.kind === 'complaint') {
    if (table.missing?.length) {
      return questionForComplaint(table.missing[0], language);
    }
    return language === 'hi'
      ? 'यह शिकायत BIS उपभोक्ता शिकायत पोर्टल पर दर्ज होगी। जाँच लें — “confirm” लिखने से पहले कुछ भी दर्ज नहीं होगा।'
      : 'This is the complaint I will file on the BIS consumer grievance portal. Nothing is filed until you reply **confirm**.';
  }
  const gap = table.missing?.length
    ? (language === 'hi'
      ? `ये खाली हैं: ${table.missing.join(', ')}. इन्हें भरें, फिर पुष्टि करें।`
      : `These are still empty: ${table.missing.join(', ')}. Fill them, then confirm.`)
    : (language === 'hi'
      ? 'ये वही डेटा हैं जो मैं प्रमाणन आवेदन पर भरूँगा। पुष्टि से पहले कुछ जमा नहीं होगा।'
      : 'These are the data I will submit for certification. Nothing is filed until you confirm.');
  return gap;
}

function questionForComplaint(field, language) {
  const pack = COMPLAINT_QUESTIONS[language] || COMPLAINT_QUESTIONS.en;
  return pack[field] || COMPLAINT_QUESTIONS.en[field];
}

/**
 * Consumer complaint: collect product → seller → bill → issue one at a time,
 * show the complaint table, and file only after explicit confirmation.
 */
export async function handleComplaintTurn({
  personaId,
  message,
  sessionId,
  portalSessionId,
  userId,
  language = 'en',
  confirmSubmit = false,
  confirmFields = null,
} = {}) {
  const text = String(message || '').trim();
  const stored = sessionId ? (getContext(sessionId) || {}) : {};
  const active = stored.currentTask === 'complaint_collect';
  if (!active && !wantsComplaintFiling(text) && !(confirmSubmit && confirmFields?.issue !== undefined)) {
    return { handled: false };
  }

  const persist = (patch) => {
    if (sessionId) updateContext(sessionId, patch, { userId, persona: personaId });
  };

  if (CANCEL_RE.test(text)) {
    persist({ currentTask: null, awaitingField: null, complaintDraft: null });
    return {
      handled: true,
      answer: language === 'hi' ? 'शिकायत रद्द की गई। कुछ भी दर्ज नहीं हुआ।' : 'Complaint cancelled. Nothing was filed.',
      table: null,
      submitted: null,
      uiMode: 'chat',
    };
  }

  const facts = { ...(stored.complaintDraft || {}) };
  const awaiting = active ? stored.awaitingField : null;
  const wantsNow = confirmSubmit || (active && CONFIRM_RE.test(text));
  if (!wantsNow) {
    Object.assign(facts, Object.fromEntries(
      Object.entries(complaintFactsFromText(text)).filter(([k]) => !facts[k] || k === awaiting),
    ));
    if (awaiting && !facts[awaiting] && text && !wantsComplaintFiling(text)) {
      facts[awaiting] = text.slice(0, 200);
    }
  }
  if (confirmFields) Object.assign(facts, pick(confirmFields, COMPLAINT_FIELDS));

  const table = complaintTable(facts);
  const nextField = table.missing[0] || null;

  if (wantsNow && !table.missing.length) {
    const submitted = await runConfirmedSubmit(table, {
      sessionId: portalSessionId || sessionId,
      userId,
      personaId,
    });
    const ref = submitted.ticket_id || submitted.tracking_id || submitted.reference_id;
    const ctx = sessionId ? (getContext(sessionId) || {}) : {};
    persist({
      currentTask: null,
      awaitingField: null,
      complaintDraft: null,
      activeRecordId: ref,
      watchedRecords: [...new Set([...(ctx.watchedRecords || []), ref].filter(Boolean))],
    });
    return {
      handled: true,
      answer: language === 'hi'
        ? `आपकी शिकायत दर्ज हो गई। टिकट **${ref}**। स्थिति बदलने पर आपको “मेरे अलर्ट” में सूचना मिलेगी।`
        : `Your complaint has been filed. Ticket **${ref}**. You can track it by asking “What is the status of my complaint ${ref}?” — you will also get an alert when its status changes.`,
      table: null,
      submitted,
      uiMode: 'status',
    };
  }

  persist({ currentTask: 'complaint_collect', awaitingField: nextField, complaintDraft: facts });

  if (nextField) {
    const intro = !active
      ? (language === 'hi'
        ? 'मैं आपकी शिकायत दर्ज करने में मदद करूँगा। कुछ विवरण एक-एक करके पूछूँगा — पुष्टि से पहले कुछ भी दर्ज नहीं होगा।'
        : 'I can file this complaint with BIS for you. I will ask a few details one at a time — nothing is filed until you confirm.')
      : '';
    return {
      handled: true,
      answer: [intro, questionForComplaint(nextField, language)].filter(Boolean).join('\n\n'),
      table: null,
      submitted: null,
      missing: table.missing,
      uiMode: 'collect',
    };
  }

  return {
    handled: true,
    answer: confirmAnswer(table, language),
    table,
    submitted: null,
    missing: [],
    uiMode: 'confirm',
  };
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
