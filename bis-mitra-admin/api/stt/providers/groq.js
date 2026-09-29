import { sttConfig } from '../config.js';

export const id = 'groq';

export async function transcribe(buffer, options = {}) {
  const cfg = sttConfig().groq;
  if (!cfg.apiKey) {
    const err = new Error('Groq STT not configured (set GROQ_API_KEY)');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const form = new FormData();
  const mime = options.mimeType || 'audio/webm';
  const name = options.filename || 'audio.webm';
  form.append('file', new Blob([buffer], { type: mime }), name);
  form.append('model', cfg.model);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const lang = languageParam(options.languageMode);
  if (lang) form.append('language', lang);

  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || data.error || res.statusText || 'Groq transcription failed');
    err.status = res.status;
    if (res.status === 429) err.code = 'RATE_LIMIT';
    throw err;
  }

  return {
    text: data.text || '',
    language: data.language || lang || null,
    confidence: null,
  };
}

function languageParam(languageMode) {
  if (languageMode === 'hi') return 'hi';
  if (languageMode === 'en') return 'en';
  return null;
}
