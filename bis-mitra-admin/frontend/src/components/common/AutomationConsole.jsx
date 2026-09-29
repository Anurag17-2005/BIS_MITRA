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
        onUserPortal={() => window.open(import.meta.env.VITE_USER_PORTAL_URL || 'http://localhost:5002', '_blank', 'noopener')}
        onSignOut={onSignOut}
      />
      <h2 style={{ fontSize: 16, marginBottom: 12, fontWeight: 500 }}>Autofetch</h2>
      <AutomationPanel />
    </div>
  );
}
