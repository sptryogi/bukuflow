export default function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div>
      <div className={`bar ${pct >= 100 ? "done" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {label && <div className="muted small" style={{ marginTop: 4 }}>{label}</div>}
    </div>
  );
}
