function Pill({ name, svc }) {
  const ok = !!svc?.ok;
  return (
    <span className={`health-pill ${ok ? 'ok' : 'down'}`} title={svc?.url || name}>
      <span className="dot" />
      {name}
    </span>
  );
}

export default function HealthStrip({ status }) {
  if (!status) return null;
  return (
    <div className="health-strip">
      <Pill name="Clone API :4000" svc={status.cloneApi} />
      <Pill name="BIS :3001" svc={status.bis} />
      <Pill name="eBIS :3002" svc={status.manak} />
      <Pill name="Standards :3003" svc={status.standards} />
    </div>
  );
}
