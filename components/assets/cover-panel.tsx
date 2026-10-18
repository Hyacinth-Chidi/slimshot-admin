'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { removeCover } from '@/lib/api/assets';
import { uploadCover } from '@/lib/upload/cover';
import { Artwork } from './artwork';

/** The types the server accepts for a cover (it checks the bytes too). */
const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * A sound's cover: shown, added, replaced or removed. A sound without one is
 * normal; the app shows a fallback tile, as this panel does.
 */
export function CoverPanel({ assetId, coverUrl }: { assetId: string; coverUrl: string | null }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['assets'] });

  const upload = useMutation({
    mutationFn: (file: File) => uploadCover(assetId, file),
    onMutate: () => setError(null),
    onError: (err: Error) => setError(err.message),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: () => removeCover(assetId),
    onMutate: () => setError(null),
    onError: (err: Error) => setError(err.message),
    onSettled: refresh,
  });

  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-3">
      <Artwork id={assetId} size={96} src={coverUrl ?? undefined} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-11 md:h-8"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {coverUrl ? 'Replace' : 'Add cover'}
        </Button>
        {coverUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 md:h-8"
            disabled={busy}
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-label="Cover image file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload.mutate(file);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
