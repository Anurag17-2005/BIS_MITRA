export default function MitraSettingsPage({ language, onLanguageChange }) {
  return (
    <div className="mitra-page">
      <h2>⚙️ Settings</h2>
      <label className="mitra-setting-row">
        <span>Language</span>
        <select value={language} onChange={(e) => onLanguageChange(e.target.value)}>
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </select>
      </label>
      <p className="mitra-panel-meta">More settings will appear in the production user portal.</p>
    </div>
  );
}
