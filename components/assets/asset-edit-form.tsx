'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryPicker } from '@/components/categories/category-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateAsset, type AssetDetail } from '@/lib/api/assets';
import { toast } from '@/lib/use-toast';

/** Title, author and category, saved together. Save stays off until something changed. */
export function AssetEditForm({ asset }: { asset: AssetDetail }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(asset.title);
  const [author, setAuthor] = useState(asset.author ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(asset.categoryId);

  const dirty =
    title.trim() !== asset.title || author.trim() !== (asset.author ?? '') || categoryId !== asset.categoryId;

  const save = useMutation({
    mutationFn: () =>
      updateAsset(asset.id, { title: title.trim(), authorName: author.trim(), categoryId }),
    onSuccess: () => toast('Sound saved.', 'success'),
    onError: (err: Error) => toast(err.message, 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
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
        <label htmlFor="asset-title" className="text-sm font-medium text-text">
          Title
        </label>
        <Input id="asset-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="asset-author" className="text-sm font-medium text-text">
          Author
        </label>
        <Input id="asset-author" value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Category</span>
        <CategoryPicker kind={asset.kind} value={categoryId} onChange={setCategoryId} />
      </div>
      <Button type="submit" className="self-start" disabled={!dirty || !title.trim() || save.isPending}>
        Save
      </Button>
    </form>
  );
}
