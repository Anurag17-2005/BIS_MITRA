import { providerConfigured, providerOrder } from './config.js';
import { logStt, sttMetricsSummary } from './metrics.js';
import { normalizeTranscript } from './normalize.js';
import * as groq from './providers/groq.js';
import * as sarvam from './providers/sarvam.js';
import * as bhashini from './providers/bhashini.js';

const PROVIDERS = {
  groq,
  sarvam,
  bhashini,
};

/**
 * @param {Buffer|Uint8Array} audioBuffer
 * @param {{ mimeType?: string, filename?: string, languageMode?: 'auto'|'hi'|'en', highAccuracy?: boolean }} options
 */
export async function transcribeAudio(audioBuffer, options = {}) {
  const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
  if (!buffer.length) {
    throw new Error('Empty audio buffer');
  }

  const chain = providerOrder(options).filter((id) => PROVIDERS[id] && providerConfigured(id));
  if (!chain.length) {
    const err = new Error('No STT provider configured. Set GROQ_API_KEY (recommended) or SARVAM_API_KEY.');
    err.code = 'NO_PROVIDER';
    throw err;
  }

  let lastError;
  for (const providerId of chain) {
    const impl = PROVIDERS[providerId];
    const started = Date.now();
    try {
      const raw = await impl.transcribe(buffer, options);
      const text = normalizeTranscript(raw.text, options);
      if (!text) {
        throw new Error('Empty transcript');
      }
      logStt({
        provider: providerId,
        ok: true,
        ms: Date.now() - started,
        bytes: buffer.length,
        languageMode: options.languageMode || 'auto',
      });
      return {
        text,
        detectedLanguage: raw.language || null,
        confidence: raw.confidence ?? null,
        provider: providerId,
      };
    } catch (e) {
      logStt({
        provider: providerId,
        ok: false,
        ms: Date.now() - started,
        bytes: buffer.length,
        error: e.message,
        code: e.code,
        status: e.status,
      });
      lastError = e;
    }
  }

  throw lastError || new Error('Transcription failed');
}

export function transcribeStatus() {
  const cfg = providerOrder({ highAccuracy: false });
  return {
    providers: cfg.map((id) => ({
      id,
      configured: providerConfigured(id),
    })),
    metrics: sttMetricsSummary(),
  };
}

export { sttMetricsSummary };
