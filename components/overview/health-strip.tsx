import { TriangleAlert } from 'lucide-react';

/**
 * Renders only when the processing queue has a problem: a panel that said
 * "all healthy" every day would train the reader to ignore it.
 */
export function HealthStrip({ failed, delayed }: { failed: number; delayed: number }) {
  if (failed === 0 && delayed === 0) return null;

  const parts: string[] = [];
  if (failed > 0) parts.push(`${failed} failed`);
  if (delayed > 0) parts.push(`${delayed} delayed`);

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text"
    >
      <TriangleAlert size={18} className="shrink-0 text-warning" aria-hidden />
      <span>Processing queue needs attention: {parts.join(', ')} jobs.</span>
    </div>
  );
}
