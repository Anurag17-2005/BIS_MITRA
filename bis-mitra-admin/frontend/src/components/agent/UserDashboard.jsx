import { useEffect, useState } from 'react';
import * as api from '../../api';
import MitraShell from '../mitra/MitraShell';

/** End-user BIS MITRA portal — shared Agent shell, published cluster only. */
export default function UserDashboard({ onMaintainerLogin }) {
  const [personaId, setPersonaId] = useState('citizen');
  const [clusterId, setClusterId] = useState(null);
  const [clusterName, setClusterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getPortalConfig()
      .then((cfg) => {
        if (!cfg.publishedClusterId) {
          throw new Error('No knowledge cluster is published yet. Ask your administrator to publish one.');
        }
        setClusterId(cfg.publishedClusterId);
        setClusterName(cfg.publishedClusterName || cfg.publishedClusterId);
      })
      .catch((err) => setError(err.message || 'Could not load portal'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MitraShell
      variant="user"
      clusterId={clusterId}
      clusterName={clusterName}
      personaId={personaId}
      onPersonaChange={setPersonaId}
      onMaintainerLogin={onMaintainerLogin}
      loading={loading}
      error={error}
    />
  );
}
