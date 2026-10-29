import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * The SlimShot mark (the app's assets/logo.png): a white S with a play shape,
 * made for dark backgrounds. Decorative wherever "SlimShot" is written beside
 * it; pass `named` where it stands alone (the collapsed sidebar). Unoptimised:
 * it is a 10 KB file, and served as is it needs no image optimiser on the VPS.
 */
export function BrandLogo({ named = false, className }: { named?: boolean; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt={named ? 'SlimShot' : ''}
      width={399}
      height={487}
      unoptimized
      className={cn('h-8 w-auto shrink-0', className)}
    />
  );
}
