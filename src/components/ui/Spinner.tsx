export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-row" role="status" aria-live="polite">
      <span className="spinner" />
      {label ? <span className="spinner-label">{label}</span> : null}
    </div>
  );
}
