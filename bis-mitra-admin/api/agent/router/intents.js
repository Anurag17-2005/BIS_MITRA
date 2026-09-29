/**
 * Shared intent matchers used by the router, confirmation flow, and chat pipeline.
 * One definition per intent so routing and task execution never disagree.
 */

const COMPLAINT_NOUN = '(?:complaint|grievance|शिकायत)';

const COMPLAINT_FILE_RES = [
  new RegExp(`\\b(?:file|lodge|register|raise|submit|make|report|open|start|write)\\b[^.?!]{0,40}\\b${COMPLAINT_NOUN}`, 'i'),
  /\b(?:i\s+(?:want|need|would\s+like)\s+to|help\s+me|how\s+(?:do|can)\s+i)\s+complain\b/i,
  /\bcomplain\s+(?:about|against)\b/i,
  /शिकायत\s*(?:दर्ज|करनी|करना|करें|करूँ)/,
];

const COMPLAINT_TRACK_RE = new RegExp(
  `\\b(?:status|track|tracking|update|progress|action\\s+taken|what\\s+happened)\\b[^.?!]{0,40}\\b${COMPLAINT_NOUN}`
  + `|\\b${COMPLAINT_NOUN}\\b[^.?!]{0,30}\\b(?:status|update|progress)\\b`
  + '|\\bcomplaint\\s+i\\s+filed\\b',
  'i',
);

const COMPLAINT_INFO_RE = /\b(?:what\s+is|explain|how\s+does|how\s+long|who\s+handles|rights?)\b/i;

export function wantsComplaintTracking(message) {
  return COMPLAINT_TRACK_RE.test(String(message || ''));
}

/** User wants to file a new complaint (not track one, not ask how complaints work in general). */
export function wantsComplaintFiling(message) {
  const text = String(message || '');
  if (wantsComplaintTracking(text)) return false;
  if (!COMPLAINT_FILE_RES.some((re) => re.test(text))) return false;
  return !(COMPLAINT_INFO_RE.test(text) && !/\b(?:i\s+want|help\s+me|file|lodge|register)\b/i.test(text));
}

/** RegExp-compatible matcher so it can sit inside ROUTE_RULES pattern lists. */
export const COMPLAINT_FILING_PATTERN = {
  source: 'wantsComplaintFiling',
  test: wantsComplaintFiling,
};

export const COMPLAINT_TRACKING_PATTERN = {
  source: 'wantsComplaintTracking',
  test: wantsComplaintTracking,
};

/** Intents that execute or inspect workflows — never overridden by knowledge probes. */
export const TRANSACTIONAL_INTENTS = new Set(['task', 'workflow_status', 'document']);
