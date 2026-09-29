import { transcribeAudio, transcribeStatus } from '../stt/index.js';

export function registerTranscribeRoutes(app, upload) {
  app.get('/api/transcribe/status', (_req, res) => {
    res.json(transcribeStatus());
  });

  app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: 'No audio file received. Send multipart field "audio".' });
      }

      const languageMode = ['auto', 'hi', 'en'].includes(req.body?.languageMode)
        ? req.body.languageMode
        : 'auto';
      const highAccuracy = req.body?.highAccuracy === true
        || req.body?.highAccuracy === 'true';

      const result = await transcribeAudio(req.file.buffer, {
        mimeType: req.file.mimetype || 'audio/webm',
        filename: req.file.originalname || 'recording.webm',
        languageMode,
        highAccuracy,
      });

      res.json(result);
    } catch (e) {
      const status = e.code === 'NO_PROVIDER' ? 503 : 502;
      res.status(status).json({
        error: e.message || 'Transcription failed',
        code: e.code || 'TRANSCRIBE_FAILED',
      });
    }
  });
}
