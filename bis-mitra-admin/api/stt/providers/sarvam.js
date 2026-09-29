import { sttConfig } from '../config.js';

export const id = 'sarvam';

export async function transcribe(buffer, options = {}) {
  const cfg = sttConfig().sarvam;
  if (!cfg.apiKey) {
    const err = new Error('Sarvam STT not configured (set SARVAM_API_KEY)');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const form = new FormData();
  const mime = options.mimeType || 'audio/webm';
  const name = options.filename || 'audio.webm';
  form.append('file', new Blob([buffer], { type: mime }), name);
  form.append('model', cfg.model);

  const mode = options.languageMode === 'auto' || options.highAccuracy
    ? cfg.mode
    : 'transcribe';
  form.append('mode', mode);

  const langCode = sarvamLanguageCode(options.languageMode);
  if (langCode) form.append('language_code', langCode);

  const res = await fetch(`${cfg.baseUrl}/speech-to-text`, {
    method: 'POST',
    headers: { 'api-subscription-key': cfg.apiKey },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || res.statusText || 'Sarvam transcription failed');
    err.status = res.status;
    if (res.status === 429) err.code = 'RATE_LIMIT';
    throw err;
  }

  const text = data.transcript || data.text || data.output || '';
  return {
    text,
    language: data.language_code || langCode || null,
    confidence: data.confidence ?? null,
  };
}

function sarvamLanguageCode(languageMode) {
  if (languageMode === 'hi') return 'hi-IN';
  if (languageMode === 'en') return 'en-IN';
  return 'unknown';
}
