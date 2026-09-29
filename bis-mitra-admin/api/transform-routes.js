import {
  getTransformStatus,
  listGoldenSummaries,
  listGoldenGrouped,
  getGoldenRecord,
  listChunkSummaries,
  listChunksGrouped,
  runTransform,
  searchIndex,
  promoteIndexToLive,
  clearTransformData,
  listAllTransformStatus,
} from './transformation/service.js';

function bindTransformRoutes(app, prefix) {
  app.get(`${prefix}/status`, (req, res) => {
    try {
      res.json(getTransformStatus(req.params.clusterId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${prefix}/golden`, (req, res) => {
    try {
      if (req.query.grouped === '1') {
        return res.json(listGoldenGrouped(req.params.clusterId));
      }
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      res.json(listGoldenSummaries(req.params.clusterId, { limit, offset }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${prefix}/golden/:warehouseItemId`, (req, res) => {
    try {
      const record = getGoldenRecord(req.params.clusterId, req.params.warehouseItemId);
      if (!record) return res.status(404).json({ error: 'Golden record not found' });
      res.json(record);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${prefix}/chunks`, (req, res) => {
    try {
      if (req.query.grouped === '1') {
        return res.json(listChunksGrouped(req.params.clusterId));
      }
      const limit = parseInt(req.query.limit || '30', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const section = req.query.section || null;
      res.json(listChunkSummaries(req.params.clusterId, { limit, offset, section }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${prefix}/run`, async (req, res) => {
    try {
      const stage = req.body.stage || 'incremental';
      if (!process.env.OCR_ENABLED) process.env.OCR_ENABLED = '0';
      const result = await runTransform(req.params.clusterId, stage);
      let indexPromoted = null;
      if (stage === 'full' || stage === 'all') {
        try {
          indexPromoted = promoteIndexToLive(req.params.clusterId);
        } catch {
          indexPromoted = null;
        }
      }
      res.json({ message: `Transform ${stage} complete`, result, indexPromoted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${prefix}/search`, (req, res) => {
    try {
      const { query, topK, stage } = req.body;
      if (!query?.trim()) return res.status(400).json({ error: 'query required' });
      res.json(searchIndex(req.params.clusterId, query.trim(), {
        topK: topK || 5,
        stage: stage || 'live',
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${prefix}/promote`, (req, res) => {
    try {
      const manifest = promoteIndexToLive(req.params.clusterId);
      res.json({ message: 'Draft index promoted to live', manifest });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post(`${prefix}/clear`, (req, res) => {
    try {
      const layers = req.body.layers || ['golden', 'chunks', 'index'];
      const result = clearTransformData(req.params.clusterId, layers);
      res.json({ message: 'Transform data cleared', ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

export function registerTransformRoutes(app) {
  app.get('/api/transform/overview', (_req, res) => {
    try {
      res.json({ clusters: listAllTransformStatus() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  bindTransformRoutes(app, '/api/transform/:clusterId');
  bindTransformRoutes(app, '/api/clusters/:clusterId/transform');
}

export { promoteIndexToLive };
