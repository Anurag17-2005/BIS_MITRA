import { sttConfig } from '../config.js';

export const id = 'bhashini';

/**
 * Minimal Bhashini / Dhruva ASR fallback when pipeline env is configured.
 * @see https://bhashini.gov.in/ — pipeline IDs vary by registration.
 */
export async function transcribe(buffer, options = {}) {
  const cfg = sttConfig().bhashini;
  if (!cfg.userId || !cfg.apiKey || !cfg.pipelineId) {
    const err = new Error('Bhashini STT not configured');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const audioB64 = Buffer.from(buffer).toString('base64');
  const sourceLang = options.languageMode === 'en' ? 'en' : 'hi';

  const body = {
    pipelineTasks: [
      {
        taskType: 'asr',
        config: {
          language: { sourceLanguage: sourceLang },
          serviceId: cfg.asrServiceId || undefined,
          audioFormat: 'webm',
          samplingRate: 16000,
        },
      },
    ],
    inputData: {
      audio: [{ audioContent: audioB64 }],
    },
  };

  const res = await fetch(`${cfg.baseUrl}/services/inference/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      userID: cfg.userId,
      ulcaApiKey: cfg.apiKey,
      Authorization: cfg.apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Bhashini transcription failed');
    err.status = res.status;
    throw err;
  }

  const text = extractBhashiniText(data);
  if (!text) {
    throw new Error('Bhashini returned empty transcript');
  }

  return {
    text,
    language: sourceLang,
    confidence: null,
  };
}

function extractBhashiniText(data) {
  const pipeline = data.pipelineResponse || data.output || data;
  const tasks = pipeline?.pipelineTasks || pipeline?.tasks || [];
  for (const task of tasks) {
    const chunks = task?.output?.[0]?.source || task?.output?.source;
    if (typeof chunks === 'string') return chunks;
    if (Array.isArray(chunks)) {
      return chunks.map((c) => c.source || c).join(' ').trim();
    }
  }
  if (typeof data.text === 'string') return data.text;
  return '';
}
