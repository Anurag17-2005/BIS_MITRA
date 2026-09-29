export default function TrustStrip({ trust }) {
  if (!trust) return null;

  return (
    <div className="trust-strip">
      <span>{trust.artifacts} artifacts</span>
      <span>{trust.fetchRuns} fetches</span>
      {trust.openFailures > 0 && (
        <span className="trust-warn">{trust.openFailures} failed</span>
      )}
      {trust.quarantineCount > 0 && (
        <span className="trust-warn">{trust.quarantineCount} quarantine</span>
      )}
    </div>
  );
}
