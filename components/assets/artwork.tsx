/**
 * A sound's cover when it has one; otherwise a gradient keyed on the asset id,
 * which keeps the layout and gives each sound a stable look.
 */
export function Artwork({ id, size = 40, src }: { id: string; size?: number; src?: string }) {
  if (src) {
    return (
      // A plain img: covers come from the storage CDN, already sized for a thumbnail.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

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
