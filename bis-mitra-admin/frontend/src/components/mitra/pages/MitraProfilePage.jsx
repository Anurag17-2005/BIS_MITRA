export default function MitraProfilePage({ persona }) {
  return (
    <div className="mitra-page">
      <h2>👤 Profile</h2>
      <div className="mitra-profile-card">
        <span className="mitra-profile-icon">{persona.icon}</span>
        <div>
          <h3>{persona.label}</h3>
          <p>{persona.description}</p>
          <p className="mitra-panel-meta">Demo persona — impersonation for development.</p>
        </div>
      </div>
      <section className="mitra-context-block">
        <h4>Focus areas</h4>
        <ul className="mitra-doc-list">
          {(persona.focusAreas || []).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
