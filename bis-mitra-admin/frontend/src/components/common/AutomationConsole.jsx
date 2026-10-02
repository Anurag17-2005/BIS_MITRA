import { config } from '../../config.js';
import AppNav from './AppNav';
import AutomationPanel from './AutomationPanel';

export default function AutomationConsole({ onNav, onSignOut }) {
  return (
    <div className="app">
      <AppNav
        active="autofetch"
        onClusters={() => onNav('clusters')}
        onAutofetch={() => {}}
        onTransform={() => onNav('transform')}
        onRules={() => onNav('rules')}
        onAgent={() => onNav('agent')}
        onUserPortal={() => window.open(config.userPortalUrl, '_blank', 'noopener')}
        onSignOut={onSignOut}
      />
      <h2 style={{ fontSize: 16, marginBottom: 12, fontWeight: 500 }}>Autofetch</h2>
      <AutomationPanel />
    </div>
  );
}
