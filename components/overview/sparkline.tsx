export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length === 0) {
    return (
      <div className={className}>
        <p className="py-8 text-center text-sm text-subtle">No uploads yet</p>
      </div>
    );
  }

  const W = 100;
  const H = 30;
  const max = Math.max(...points);
  const min = Math.min(...points);
  // A flat series has range 0. Dividing by it yields NaN and the path vanishes.
  const range = max - min || 1;
  const step = points.length > 1 ? W / (points.length - 1) : 0;

  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(H - ((v - min) / range) * H).toFixed(2)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
      <path d={d} fill="none" stroke="var(--brand-from)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
