import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatBytes, StatCards } from './stat-cards';

const HEALTHY = { total: 318, published: 204, processing: 0, failed: 0, totalBytes: 1_288_490_188 };

function card(name: string) {
  return screen.getByTestId(`stat-${name}`);
}

describe('StatCards', () => {
  it('shows the four library figures with their labels', () => {
    render(<StatCards stats={HEALTHY} />);
    expect(within(card('total')).getByText('Total assets')).toBeInTheDocument();
    expect(within(card('total')).getByText('318')).toBeInTheDocument();
    expect(within(card('published')).getByText('Live in the app')).toBeInTheDocument();
    expect(within(card('published')).getByText('204')).toBeInTheDocument();
    expect(within(card('processing')).getByText('Processing')).toBeInTheDocument();
    expect(within(card('failed')).getByText('Failed')).toBeInTheDocument();
  });

  it('says how much storage the library uses', () => {
    render(<StatCards stats={HEALTHY} />);
    expect(within(card('total')).getByText('1.2 GB stored')).toBeInTheDocument();
  });

  it('shows the live share of the library as text and as a meter', () => {
    render(<StatCards stats={HEALTHY} />);
    expect(within(card('published')).getByText('64% of the library')).toBeInTheDocument();
    const meter = within(card('published')).getByRole('meter', { name: /live in the app/i });
    expect(meter).toHaveAttribute('aria-valuenow', '64');
  });

  it('handles an empty library without dividing by zero', () => {
    render(<StatCards stats={{ total: 0, published: 0, processing: 0, failed: 0, totalBytes: 0 }} />);
    expect(within(card('published')).getByText('Nothing published yet')).toBeInTheDocument();
    expect(within(card('total')).getByText('No files stored yet')).toBeInTheDocument();
  });

  it('says whether anything is processing', () => {
    const { rerender } = render(<StatCards stats={HEALTHY} />);
    expect(within(card('processing')).getByText('Nothing in progress')).toBeInTheDocument();
    rerender(<StatCards stats={{ ...HEALTHY, processing: 3 }} />);
    expect(within(card('processing')).getByText('In progress now')).toBeInTheDocument();
  });

  it('stays calm when nothing failed', () => {
    render(<StatCards stats={HEALTHY} />);
    expect(card('failed')).toHaveAttribute('data-tone', 'default');
    expect(within(card('failed')).getByText('Nothing failed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review failed assets/i })).toBeNull();
  });

  it('flags failures and offers a way to act on them', () => {
    render(<StatCards stats={{ ...HEALTHY, failed: 2 }} />);
    expect(card('failed')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByRole('link', { name: 'Review failed assets' })).toHaveAttribute(
      'href',
      '/assets?status=failed',
    );
  });

  it('formats large numbers with separators', () => {
    render(<StatCards stats={{ ...HEALTHY, total: 12_840 }} />);
    expect(within(card('total')).getByText('12,840')).toBeInTheDocument();
  });

  it('shows a dash in every card while loading', () => {
    render(<StatCards stats={undefined} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [900, '900 B'],
    [1_536, '1.5 KB'],
    [52_428_800, '50 MB'],
    [1_288_490_188, '1.2 GB'],
  ])('%d bytes → %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
