import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingRegion, Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('is a decorative pulsing block that holds still for reduced motion', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const block = container.firstElementChild as HTMLElement;
    expect(block).toHaveAttribute('aria-hidden', 'true');
    expect(block).toHaveClass('animate-pulse', 'motion-reduce:animate-none', 'bg-elevated', 'h-4', 'w-32');
  });
});

describe('LoadingRegion', () => {
  it('announces what is loading to screen readers without showing loading text', () => {
    render(
      <LoadingRegion label="Loading users">
        <Skeleton className="h-4" />
      </LoadingRegion>,
    );
    const region = screen.getByRole('status', { name: 'Loading users' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    // The label is there for assistive technology only.
    expect(screen.getByText('Loading users')).toHaveClass('sr-only');
  });
});
