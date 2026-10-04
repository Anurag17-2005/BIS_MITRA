import { useState, useEffect, useCallback } from 'react';
import { config } from '../../config.js';
import AppNav from '../common/AppNav';
import TransformInspector from './TransformInspector';
import TrustStrip from '../common/TrustStrip';
import * as api from '../../api';
import { clusterCanRunTransform } from '../../clusters.js';

export default function TransformConsole({ clusters, onNav, onSignOut }) {
  const [overview, setOverview] = useState([]);
  const [clusterId, setClusterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [trust, setTrust] = useState(null);

  const reloadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const { clusters: rows } = await api.getTransformOverview();
      setOverview(rows);
      setClusterId(prev => {
        if (prev && rows.some(r => r.clusterId === prev)) return prev;
        const published = rows.find(c => c.published);
        return published?.clusterId || rows[0]?.clusterId || '';
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reloadOverview().catch(() => {}); }, [reloadOverview]);

  useEffect(() => {
    if (!clusterId) return;
    api.getClusterTrust(clusterId).then(setTrust).catch(() => setTrust(null));
  }, [clusterId]);

  const active = overview.find(c => c.clusterId === clusterId);
  const clusterOptions = clusters.length ? clusters : overview;
  const activeMeta = clusterOptions.find(c => (c.id || c.clusterId) === clusterId);
  const transformReadOnly = activeMeta ? !clusterCanRunTransform(activeMeta) : false;

  return (
    <div className="app">
      <AppNav
        active="transform"
        onClusters={() => onNav('clusters')}
        onAutofetch={() => onNav('autofetch')}
        onTransform={() => {}}
        onRules={() => onNav('rules')}
        onAgent={() => onNav('agent')}
        onUserPortal={() => window.open(config.userPortalUrl, '_blank', 'noopener')}
        onSignOut={onSignOut}
      />
      <TrustStrip trust={trust} />
      <div className="transform-cluster-bar">
        <select className="wh-filter" value={clusterId} onChange={e => setClusterId(e.target.value)}>
          {clusterOptions.map(c => (
            <option key={c.id || c.clusterId} value={c.id || c.clusterId}>
              {c.name}{c.published ? ' ★' : ''}
            </option>
          ))}
        </select>
        {active && !loading && (
          <span className="row-sub">
            {active.golden?.count ?? 0} golden · {active.chunks?.count ?? 0} chunks · {active.index?.live?.chunkCount ?? 0} indexed
          </span>
        )}
      </div>
      {clusterId && (
        <TransformInspector
          clusterId={clusterId}
          onChanged={reloadOverview}
          readOnly={transformReadOnly}
        />
      )}
    </div>
  );
}
