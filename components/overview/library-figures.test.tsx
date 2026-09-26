import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LibraryFigures } from './library-figures';

const HEALTHY = { total: 318, published: 204, processing: 0, failed: 0 };

describe('LibraryFigures', () => {
  it('lists the four library figures with plain labels', () => {
    render(<LibraryFigures counts={HEALTHY} />);
    expect(screen.getByText('assets in the library')).toBeInTheDocument();
    expect(screen.getByText('live in the app')).toBeInTheDocument();
    expect(screen.getByText('processing')).toBeInTheDocument();
    expect(screen.getByText('failed to process')).toBeInTheDocument();
    expect(screen.getByText('318')).toBeInTheDocument();
    expect(screen.getByText('204')).toBeInTheDocument();
  });

  it('stays quiet when nothing has failed', () => {
    render(<LibraryFigures counts={HEALTHY} />);
    expect(screen.getByTestId('figure-failed')).toHaveAttribute('data-tone', 'default');
    expect(screen.queryByRole('link', { name: /review/i })).toBeNull();
  });

  it('flags failures with an icon, a label and a way to act on them', () => {
    render(<LibraryFigures counts={{ ...HEALTHY, failed: 2 }} />);
    expect(screen.getByTestId('figure-failed')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByRole('link', { name: 'Review failed assets' })).toHaveAttribute(
      'href',
      '/assets?status=failed',
    );
  });

  it('formats large numbers with separators', () => {
    render(<LibraryFigures counts={{ ...HEALTHY, total: 12_840 }} />);
    expect(screen.getByText('12,840')).toBeInTheDocument();
  });

  it('shows a dash for every figure while loading', () => {
    render(<LibraryFigures counts={undefined} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
});
