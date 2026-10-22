'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateAsset, type AssetDetail } from '@/lib/api/assets';
import { updateFontLicense } from '@/lib/api/fonts';
import { uploadFontVersion } from '@/lib/upload/font-version';
import { toast } from '@/lib/use-toast';

/** UpdateFontDto: @MaxLength(500) on license. */
const LICENSE_MAX = 500;

/** Everything that shows a font: its page, the list and the Order page. */
function useRefreshFont() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['fonts'] });
  };
}

/**
 * The display name. Family and style come from the file and cannot be
 * edited; a new name redraws the preview on the server, which the refetch
 * then shows.
 */
export function FontEditForm({ asset }: { asset: AssetDetail }) {
  const refresh = useRefreshFont();
  const [title, setTitle] = useState(asset.title);

  const dirty = title.trim() !== asset.title;

  const save = useMutation({
    mutationFn: () => updateAsset(asset.id, { title: title.trim() }),
    onSuccess: () => toast('Font saved.', 'success'),
    onError: (err: Error) => toast(err.message, 'error'),
    onSettled: refresh,
  });

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && title.trim()) save.mutate();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="font-title" className="text-sm font-medium text-text">
          Display name
        </label>
        <Input id="font-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        <p className="text-xs text-subtle">What the app shows. The preview is drawn from it.</p>
      </div>
      <Button type="submit" className="self-start" disabled={!dirty || !title.trim() || save.isPending}>
        Save
      </Button>
    </form>
  );
}

/** The owner's note on where the font comes from and what its licence allows. Emptied, it is cleared. */
export function FontLicenseForm({ asset }: { asset: AssetDetail }) {
  const refresh = useRefreshFont();
  const saved = asset.font?.license ?? '';
  const [license, setLicense] = useState(saved);

  const dirty = license.trim() !== saved;

  const save = useMutation({
    mutationFn: () => updateFontLicense(asset.id, license.trim() || null),
    onSuccess: () => toast('Licence saved.', 'success'),
    onError: (err: Error) => toast(err.message, 'error'),
    onSettled: refresh,
  });

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) save.mutate();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="font-license" className="text-sm font-medium text-text">
          Licence
        </label>
        <Input
          id="font-license"
          value={license}
          maxLength={LICENSE_MAX}
          placeholder="For example: SIL Open Font License 1.1, from Google Fonts"
          onChange={(e) => setLicense(e.target.value)}
        />
        <p className="text-xs text-subtle">For your records only. The app never shows it.</p>
      </div>
      <Button type="submit" variant="secondary" className="self-start" disabled={!dirty || save.isPending}>
        Save licence
      </Button>
    </form>
  );
}

/**
 * A fixed file for this font. The server checks it is the same family and
 * style, keeps the old version, and makes this one current under the same id,
 * so projects that use the font get the fix. Its reason for refusing a file
 * shows under the button.
 */
export function FontVersionUpload({ assetId }: { assetId: string }) {
  const refresh = useRefreshFont();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadFontVersion(assetId, file),
    onMutate: () => setError(null),
    onSuccess: () => toast('New version uploaded.', 'success'),
    onError: (err: Error) => setError(err.message),
    onSettled: refresh,
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-11 self-start md:h-8"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? 'Uploading…' : 'Upload new version'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf"
        aria-label="Upload new version"
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
