import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { DeleteDialog } from './delete-dialog';

describe('DeleteDialog', () => {
  it('shows the asset count from a 409 rather than a generic failure', () => {
    // The count is the one number that makes this error actionable. Falling
    // back to a generic toast loses it.
    const err = new ApiError(
      {
        code: 'CONFLICT',
        message: 'Cannot delete: 12 assets use this category.',
        traceId: 't',
      },
      409,
    );

    render(<DeleteDialog open name="SFX" error={err} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/12 assets use this category/i)).toBeInTheDocument();
  });

  it('offers to view the blocking assets on a 409', () => {
    const err = new ApiError({ code: 'CONFLICT', message: '3 assets use this category.', traceId: 't' }, 409);
    render(<DeleteDialog open name="SFX" error={err} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument();
  });

  it('shows a plain confirmation when there is no error yet', () => {
    render(<DeleteDialog open name="SFX" error={null} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/delete "SFX"/i)).toBeInTheDocument();
  });
});

describe('DeleteDialog R10a: categoryId-scoped view link', () => {
  it('links to /assets?categoryId=<id> when categoryId is provided', () => {
    const err = new ApiError({ code: 'CONFLICT', message: '3 assets use this category.', traceId: 't' }, 409);
    render(
      <DeleteDialog
        open
        name="SFX"
        categoryId="c1"
        error={err}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('link', { name: /view/i })).toHaveAttribute(
      'href',
      '/assets?categoryId=c1',
    );
  });

  it('links to plain /assets when categoryId is absent', () => {
    const err = new ApiError({ code: 'CONFLICT', message: '3 assets use this category.', traceId: 't' }, 409);
    render(<DeleteDialog open name="SFX" error={err} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /view/i })).toHaveAttribute('href', '/assets');
  });
});
