import { useState } from 'react';
import AppNav from '../common/AppNav';
import PortalApp from '@bis-user/portal/PortalApp';
import '@bis-user/portal/portal.css';

import { config } from '../../config.js';

const USER_PORTAL = config.userPortalUrl;

/** Admin agent preview — same portal UI, isolated preview session, stays inside admin. */
export default function AgentConsole({ clusters, onNav, onSignOut }) {
  const published = clusters.find((c) => c.published);
  const [clusterId, setClusterId] = useState(published?.id || clusters[0]?.id || '');

  return (
    <div className="app agent-embed-app">
      <AppNav
        active="agent"
        onClusters={() => onNav('clusters')}
        onAutofetch={() => onNav('autofetch')}
        onTransform={() => onNav('transform')}
        onRules={() => onNav('rules')}
        onAgent={() => {}}
        onUserPortal={() => window.open(USER_PORTAL, '_blank', 'noopener')}
        onSignOut={onSignOut}
      />
      <div className="agent-embed">
        <PortalApp
          mode="preview"
          clusterId={clusterId}
          clusters={clusters}
          onClusterChange={setClusterId}
          onExit={() => onNav('clusters')}
        />
      </div>
    </div>
  );
}
