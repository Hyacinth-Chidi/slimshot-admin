/**
 * Assets have no thumbnail until a processor generates one, and processors are
 * currently disabled server-side. A gradient keyed on the asset id keeps the
 * layout correct now and gives each asset a stable identity; real artwork
 * drops into the same box later.
 */
export function Artwork({ id, size = 40 }: { id: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;

  return (
    <div
      className="shrink-0 rounded-md"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hash} 45% 35%), hsl(${(hash + 40) % 360} 45% 25%))`,
      }}
    />
  );
}
