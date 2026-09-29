/**
 * Swappable STT provider configuration (env-only secrets).
 *
 * STT_PRIMARY=groq|sarvam|bhashini
 * STT_FALLBACK=groq,sarvam,bhashini  (comma-separated, tried after primary on failure)
 * STT_GROQ_MODEL=whisper-large-v3-turbo
 * STT_SARVAM_MODEL=saaras:v3
 * STT_SARVAM_MODE=codemix   (codemix for Hinglish; transcribe for single language)
 * STT_HIGH_ACCURACY_PROVIDER=sarvam
 */

export function sttConfig() {
  return {
    primary: (process.env.STT_PRIMARY || 'groq').toLowerCase(),
    fallback: (process.env.STT_FALLBACK || 'sarvam,bhashini')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      model: process.env.STT_GROQ_MODEL || 'whisper-large-v3-turbo',
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    },
    sarvam: {
      apiKey: process.env.SARVAM_API_KEY || '',
      model: process.env.STT_SARVAM_MODEL || 'saaras:v3',
      mode: process.env.STT_SARVAM_MODE || 'codemix',
      baseUrl: process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai',
    },
    bhashini: {
      userId: process.env.BHASHINI_USER_ID || '',
      apiKey: process.env.BHASHINI_API_KEY || '',
      pipelineId: process.env.BHASHINI_PIPELINE_ID || '',
      asrServiceId: process.env.BHASHINI_ASR_SERVICE_ID || '',
      baseUrl: process.env.BHASHINI_BASE_URL || 'https://dhruva-api.bhashini.gov.in',
    },
    highAccuracyProvider: (process.env.STT_HIGH_ACCURACY_PROVIDER || 'sarvam').toLowerCase(),
  };
}

export function providerOrder(options = {}) {
  const cfg = sttConfig();
  const high = Boolean(options.highAccuracy);
  const primary = high && cfg.highAccuracyProvider ? cfg.highAccuracyProvider : cfg.primary;
  const chain = [primary, ...cfg.fallback.filter((p) => p !== primary)];
  return [...new Set(chain)];
}

export function providerConfigured(id) {
  const cfg = sttConfig();
  if (id === 'groq') return Boolean(cfg.groq.apiKey);
  if (id === 'sarvam') return Boolean(cfg.sarvam.apiKey);
  if (id === 'bhashini') {
    return Boolean(cfg.bhashini.userId && cfg.bhashini.apiKey && cfg.bhashini.pipelineId);
  }
  return false;
}
