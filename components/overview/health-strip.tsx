export function HealthStrip({ failed, delayed }: { failed: number; delayed: number }) {
  if (failed === 0 && delayed === 0) return null;

  const parts: string[] = [];
  if (failed > 0) parts.push(`${failed} failed`);
  if (delayed > 0) parts.push(`${delayed} delayed`);

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
      Queue needs attention: {parts.join(', ')}.
    </div>
  );
}
